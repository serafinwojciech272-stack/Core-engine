alter table public.ce_billing_invoices
  drop constraint if exists ce_billing_invoices_status_check;

alter table public.ce_billing_invoices
  add constraint ce_billing_invoices_status_check
  check (status = any (array[
    'DRAFT','CALCULATED','VALIDATING','VALIDATION_HOLD','REVIEW',
    'PENDING_APPROVAL','APPROVED','READY_FOR_KSEF','BLOCKED',
    'SUBMITTING','ISSUED','REJECTED','CANCELLED'
  ]));

create or replace function public.ce_fcc_run_billing_for_event(p_service_event_id uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
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

  select * into v_contract from public.ce_billing_contracts
  where id=v_event.contract_id and tenant_id=v_event.tenant_id for update;
  if not found then raise exception 'CONTRACT_NOT_FOUND'; end if;
  if v_contract.status <> 'ACTIVE'
     or v_event.service_date < v_contract.valid_from
     or (v_contract.valid_to is not null and v_event.service_date > v_contract.valid_to) then
    raise exception 'CONTRACT_NOT_ACTIVE_FOR_SERVICE_DATE';
  end if;

  select * into v_line from public.ce_billing_contract_lines
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
  v_invoice_number:='AUTO/'||to_char(v_event.service_date,'YYYYMMDD')||'/'||
                    substr(replace(p_service_event_id::text,'-',''),1,12);

  insert into public.ce_billing_invoices(
    tenant_id,counterparty_id,contract_id,invoice_number,invoice_type,status,
    issue_date,sale_date,due_date,currency,net_amount,vat_amount,gross_amount,
    source_hash,calculation_version
  ) values(
    v_event.tenant_id,v_event.counterparty_id,v_contract.id,v_invoice_number,'VAT','VALIDATING',
    current_date,v_event.service_date,
    v_event.service_date+coalesce(v_contract.payment_terms_days,14),
    coalesce(v_line.currency,v_contract.currency,v_event.currency,'PLN'),
    v_net,v_vat,v_gross,
    md5(p_service_event_id::text||':'||v_contract.id::text||':'||v_line.id::text||':'||
        v_qty::text||':'||v_unit_price::text),
    'FCC-BILLING-V1.3'
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
     'Contract is active.','FCC-VALIDATOR-V1.3'),
    (v_event.tenant_id,v_invoice_id,'SERVICE_BILLABLE','ERROR','PASS',
     jsonb_build_object('billable',true),jsonb_build_object('billable',v_event.billable),
     'Service event is billable.','FCC-VALIDATOR-V1.3'),
    (v_event.tenant_id,v_invoice_id,'CONTRACT_LINE_MATCH','ERROR','PASS',
     jsonb_build_object('service_code',v_event.service_code),jsonb_build_object('contract_line_id',v_line.id),
     'Contract pricing line matched.','FCC-VALIDATOR-V1.3'),
    (v_event.tenant_id,v_invoice_id,'CALCULATION_TOTALS','ERROR','PASS',
     jsonb_build_object('gross_amount',v_gross),jsonb_build_object('net',v_net,'vat',v_vat,'gross',v_gross),
     'Deterministic calculation completed.','FCC-VALIDATOR-V1.3');

  if v_gross<=0 then
    insert into public.ce_billing_validation_checks(
      tenant_id,invoice_id,check_code,severity,status,message,validator_version
    ) values(v_event.tenant_id,v_invoice_id,'POSITIVE_TOTAL','ERROR','FAIL',
             'Invoice gross amount must be greater than zero.','FCC-VALIDATOR-V1.3');
    v_failed:=1;
  end if;

  if v_failed>0 then
    update public.ce_billing_invoices set status='VALIDATION_HOLD',updated_at=now() where id=v_invoice_id;
    insert into public.ce_billing_anomalies(
      tenant_id,invoice_id,contract_id,anomaly_type,severity,score,status,evidence,recommended_action
    ) values(v_event.tenant_id,v_invoice_id,v_contract.id,'VALIDATION_FAILURE','HIGH',0.95,'OPEN',
             jsonb_build_object('failed_checks',v_failed),
             'Review validation failures before approval.');
  else
    if coalesce(v_contract.approval_policy,'') not in ('NONE','EXCEPTION_ONLY')
       or not coalesce(v_contract.auto_issue_enabled,false) then
      v_approval:=true;
      insert into public.ce_billing_approvals(tenant_id,invoice_id,status,requested_reason,requested_at)
      values(v_event.tenant_id,v_invoice_id,'PENDING',
             'Billing approval gate required by contract policy.',now());
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
    'billing:v1.3:'||p_service_event_id::text,
    jsonb_build_object('service_event_id',p_service_event_id,'invoice_id',v_invoice_id,
      'net',v_net,'vat',v_vat,'gross',v_gross,'validation_failed',v_failed,'approval_required',v_approval)
  ) on conflict(tenant_id,idempotency_key) do nothing;

  return jsonb_build_object(
    'status',case when v_failed>0 then 'VALIDATION_HOLD'
                  when v_approval then 'PENDING_APPROVAL' else 'READY_FOR_KSEF' end,
    'invoice_id',v_invoice_id,'service_event_id',p_service_event_id,
    'net_amount',v_net,'vat_amount',v_vat,'gross_amount',v_gross,
    'validation_failed',v_failed,'approval_required',v_approval);
end;
$function$;

create or replace function public.ce_fcc_decide_invoice(
  p_invoice_id uuid,p_decision text,p_reason text default null,p_actor_id uuid default null
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_i public.ce_billing_invoices%rowtype;
  v_a public.ce_billing_approvals%rowtype;
  v_old text;
  v_new text;
  v_rec uuid;
begin
  if p_decision not in ('APPROVE','REJECT') then raise exception 'INVALID_DECISION'; end if;
  select * into v_i from public.ce_billing_invoices where id=p_invoice_id for update;
  if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
  v_old:=v_i.status;
  if v_i.status not in ('PENDING_APPROVAL','VALIDATING') then raise exception 'INVOICE_NOT_AWAITING_APPROVAL'; end if;

  select * into v_a from public.ce_billing_approvals
  where invoice_id=p_invoice_id and status='PENDING'
  order by requested_at desc limit 1 for update;

  if p_decision='REJECT' then
    v_new:='REJECTED';
    update public.ce_billing_invoices set status=v_new,updated_at=now() where id=p_invoice_id;
    if v_a.id is not null then
      update public.ce_billing_approvals
      set status='REJECTED',decided_at=now(),decision_note=p_reason,decided_by=p_actor_id
      where id=v_a.id;
    end if;
  else
    v_new:='READY_FOR_KSEF';
    update public.ce_billing_invoices set status=v_new,updated_at=now() where id=p_invoice_id;
    if v_a.id is not null then
      update public.ce_billing_approvals
      set status='APPROVED',decided_at=now(),decision_note=p_reason,decided_by=p_actor_id
      where id=v_a.id;
    end if;
    insert into public.ce_billing_receivables(
      tenant_id,invoice_id,counterparty_id,original_amount,open_amount,due_date,status
    ) values(v_i.tenant_id,v_i.id,v_i.counterparty_id,v_i.gross_amount,v_i.gross_amount,
             coalesce(v_i.due_date,current_date),'OPEN')
    on conflict(invoice_id) do update
      set open_amount=excluded.open_amount,status='OPEN'
    returning id into v_rec;
  end if;

  insert into public.ce_billing_approval_decisions(
    tenant_id,invoice_id,approval_id,decision,reason,decided_by
  ) values(v_i.tenant_id,v_i.id,v_a.id,p_decision,p_reason,p_actor_id);

  insert into public.ce_billing_lifecycle_events(
    tenant_id,invoice_id,from_status,to_status,event_type,actor_type,actor_id,metadata
  ) values(v_i.tenant_id,v_i.id,v_old,v_new,'APPROVAL_DECISION',
           case when p_actor_id is null then 'SYSTEM' else 'USER' end,p_actor_id,
           jsonb_build_object('decision',p_decision,'reason',p_reason));

  return jsonb_build_object('status',v_new,'invoice_id',v_i.id,'receivable_id',v_rec,'decision',p_decision);
end;
$function$;

revoke all on function public.ce_fcc_run_billing_for_event(uuid) from public;
revoke all on function public.ce_fcc_decide_invoice(uuid,text,text,uuid) from public;
revoke all on function public.ce_fcc_refresh_receivable_status(uuid) from public;
grant execute on function public.ce_fcc_run_billing_for_event(uuid) to service_role;
grant execute on function public.ce_fcc_decide_invoice(uuid,text,text,uuid) to service_role;
grant execute on function public.ce_fcc_refresh_receivable_status(uuid) to service_role;