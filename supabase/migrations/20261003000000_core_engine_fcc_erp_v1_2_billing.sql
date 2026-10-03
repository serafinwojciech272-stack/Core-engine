create or replace function public.ce_fcc_run_billing_for_event(p_service_event_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event public.ce_billing_service_events%rowtype;
  v_contract public.ce_billing_contracts%rowtype;
  v_line public.ce_billing_contract_lines%rowtype;
  v_invoice_id uuid;
  v_invoice_number text;
  v_net numeric(18,2);
  v_vat numeric(18,2);
  v_gross numeric(18,2);
  v_unit_price numeric(18,4);
  v_qty numeric(18,4);
  v_failed integer := 0;
  v_approval boolean := false;
begin
  select * into v_event from public.ce_billing_service_events where id=p_service_event_id for update;
  if not found then raise exception 'SERVICE_EVENT_NOT_FOUND'; end if;
  if v_event.billed_invoice_id is not null then
    return jsonb_build_object('status','ALREADY_BILLED','invoice_id',v_event.billed_invoice_id);
  end if;
  if not v_event.billable then raise exception 'SERVICE_EVENT_NOT_BILLABLE'; end if;

  select * into v_contract
  from public.ce_billing_contracts
  where id=v_event.contract_id and tenant_id=v_event.tenant_id
  for update;
  if not found then raise exception 'CONTRACT_NOT_FOUND'; end if;

  if v_contract.status <> 'ACTIVE'
     or v_event.service_date < v_contract.valid_from
     or (v_contract.valid_to is not null and v_event.service_date > v_contract.valid_to) then
    raise exception 'CONTRACT_NOT_ACTIVE_FOR_SERVICE_DATE';
  end if;

  select * into v_line
  from public.ce_billing_contract_lines
  where contract_id=v_contract.id and active=true and service_code=v_event.service_code
  order by created_at limit 1;
  if not found then raise exception 'CONTRACT_LINE_NOT_FOUND_FOR_SERVICE_CODE'; end if;

  v_qty:=coalesce(v_event.quantity,0);
  v_unit_price:=coalesce(v_line.unit_price,v_event.unit_price,0);
  if v_qty<=0 then raise exception 'INVALID_QUANTITY'; end if;
  if v_unit_price<0 then raise exception 'INVALID_UNIT_PRICE'; end if;

  v_net:=round(v_qty*v_unit_price,2);
  v_vat:=round(v_net*coalesce(v_line.vat_rate,0)/100,2);
  v_gross:=v_net+v_vat;
  v_invoice_number:='AUTO/'||to_char(v_event.service_date,'YYYYMMDD')||'/'||substr(replace(p_service_event_id::text,'-',''),1,12);

  insert into public.ce_billing_invoices(
    tenant_id,counterparty_id,contract_id,invoice_number,invoice_type,status,
    issue_date,sale_date,due_date,currency,net_amount,vat_amount,gross_amount,
    source_hash,calculation_version
  ) values(
    v_event.tenant_id,v_event.counterparty_id,v_contract.id,v_invoice_number,'SALES','VALIDATING',
    current_date,v_event.service_date,
    v_event.service_date+coalesce(v_contract.payment_terms_days,14),
    coalesce(v_line.currency,v_contract.currency,v_event.currency,'PLN'),
    v_net,v_vat,v_gross,
    md5(p_service_event_id::text||':'||v_contract.id::text||':'||v_line.id::text||':'||v_qty::text||':'||v_unit_price::text),
    'FCC-BILLING-V1.2'
  ) returning id into v_invoice_id;

  insert into public.ce_billing_invoice_lines(
    invoice_id,service_event_id,contract_line_id,line_no,description,service_code,
    quantity,unit,unit_price,net_amount,vat_rate,vat_amount,gross_amount
  ) values(
    v_invoice_id,p_service_event_id,v_line.id,1,coalesce(v_event.description,v_line.description),
    v_event.service_code,v_qty,v_line.unit,v_unit_price,v_net,v_line.vat_rate,v_vat,v_gross
  );

  insert into public.ce_billing_validation_checks(
    tenant_id,invoice_id,check_code,severity,status,expected_value,actual_value,message,validator_version
  ) values
    (v_event.tenant_id,v_invoice_id,'CONTRACT_ACTIVE','ERROR','PASS',
     jsonb_build_object('status','ACTIVE'),jsonb_build_object('status',v_contract.status),
     'Contract is active.','FCC-VALIDATOR-V1.2'),
    (v_event.tenant_id,v_invoice_id,'SERVICE_BILLABLE','ERROR','PASS',
     jsonb_build_object('billable',true),jsonb_build_object('billable',v_event.billable),
     'Service event is billable.','FCC-VALIDATOR-V1.2'),
    (v_event.tenant_id,v_invoice_id,'CONTRACT_LINE_MATCH','ERROR','PASS',
     jsonb_build_object('service_code',v_event.service_code),jsonb_build_object('contract_line_id',v_line.id),
     'Contract pricing line matched.','FCC-VALIDATOR-V1.2'),
    (v_event.tenant_id,v_invoice_id,'CALCULATION_TOTALS','ERROR','PASS',
     jsonb_build_object('gross_amount',v_gross),jsonb_build_object('net',v_net,'vat',v_vat,'gross',v_gross),
     'Deterministic calculation completed.','FCC-VALIDATOR-V1.2');

  if v_gross<=0 then
    insert into public.ce_billing_validation_checks(
      tenant_id,invoice_id,check_code,severity,status,message,validator_version
    ) values(v_event.tenant_id,v_invoice_id,'POSITIVE_TOTAL','ERROR','FAIL',
      'Invoice gross amount must be greater than zero.','FCC-VALIDATOR-V1.2');
    v_failed:=1;
  end if;

  if v_failed>0 then
    update public.ce_billing_invoices set status='VALIDATION_HOLD',updated_at=now() where id=v_invoice_id;
    insert into public.ce_billing_anomalies(
      tenant_id,invoice_id,contract_id,anomaly_type,severity,score,status,evidence,recommended_action
    ) values(
      v_event.tenant_id,v_invoice_id,v_contract.id,'VALIDATION_FAILURE','HIGH',0.95,'OPEN',
      jsonb_build_object('failed_checks',v_failed),'Review validation failures before approval.'
    );
  else
    if coalesce(v_contract.approval_policy,'') not in ('AUTO','NONE')
       or not coalesce(v_contract.auto_issue_enabled,false) then
      v_approval:=true;
      insert into public.ce_billing_approvals(
        tenant_id,invoice_id,status,requested_reason,requested_at
      ) values(
        v_event.tenant_id,v_invoice_id,'PENDING',
        'Billing approval gate required by contract policy.',now()
      );
      update public.ce_billing_invoices set status='PENDING_APPROVAL',updated_at=now() where id=v_invoice_id;
    else
      update public.ce_billing_invoices set status='READY_FOR_KSEF',updated_at=now() where id=v_invoice_id;
    end if;
  end if;

  update public.ce_billing_service_events set billed_invoice_id=v_invoice_id where id=p_service_event_id;

  insert into public.ce_erp_process_events(
    tenant_id,process_type,entity_type,entity_id,event_type,idempotency_key,payload
  ) values(
    v_event.tenant_id,'ORDER_TO_CASH','INVOICE',v_invoice_id,
    case when v_failed>0 then 'VALIDATION_HOLD'
         when v_approval then 'PENDING_APPROVAL'
         else 'READY_FOR_KSEF' end,
    'billing:v1.2:'||p_service_event_id::text,
    jsonb_build_object(
      'service_event_id',p_service_event_id,'invoice_id',v_invoice_id,
      'net',v_net,'vat',v_vat,'gross',v_gross,
      'validation_failed',v_failed,'approval_required',v_approval
    )
  ) on conflict(tenant_id,idempotency_key) do nothing;

  return jsonb_build_object(
    'status',case when v_failed>0 then 'VALIDATION_HOLD'
                  when v_approval then 'PENDING_APPROVAL'
                  else 'READY_FOR_KSEF' end,
    'invoice_id',v_invoice_id,'service_event_id',p_service_event_id,
    'net_amount',v_net,'vat_amount',v_vat,'gross_amount',v_gross,
    'validation_failed',v_failed,'approval_required',v_approval
  );
end;
$$;

revoke all on function public.ce_fcc_run_billing_for_event(uuid) from public;
grant execute on function public.ce_fcc_run_billing_for_event(uuid) to service_role;
