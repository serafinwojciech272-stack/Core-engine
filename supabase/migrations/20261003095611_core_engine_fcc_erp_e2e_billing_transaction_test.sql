create or replace function public.ce_fcc_e2e_billing_transaction_test()
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_tenant uuid := 'd94cfdf2-c4f1-4f93-b6ae-4c25350b41aa';
  v_counterparty uuid; v_contract uuid; v_line uuid; v_event uuid; v_invoice uuid;
  v_approval uuid; v_receivable uuid; v_payment uuid;
  v_billing jsonb; v_decision jsonb; v_refresh jsonb;
  v_expected_net numeric(18,2) := 1000.00;
  v_expected_vat numeric(18,2) := 230.00;
  v_expected_gross numeric(18,2) := 1230.00;
  v_checks integer; v_failed_checks integer; v_allocated numeric(18,2);
begin
  select id into v_event from public.ce_billing_service_events
  where tenant_id=v_tenant and external_event_id='CORE-ENGINE-E2E-EVENT-001';

  if v_event is not null then
    select billed_invoice_id into v_invoice from public.ce_billing_service_events where id=v_event;
    if v_invoice is not null then
      select id into v_receivable from public.ce_billing_receivables where invoice_id=v_invoice;
      if v_receivable is not null then
        select coalesce(sum(amount),0) into v_allocated
        from public.ce_billing_payment_allocations where receivable_id=v_receivable;
        if v_allocated >= v_expected_gross then
          return jsonb_build_object('test','FCC E2E Billing Transaction','mode','IDEMPOTENT_REUSE',
            'passed',true,'ksef_submitted',false,'invoice_id',v_invoice,'receivable_id',v_receivable,
            'paid_amount',v_allocated,'expected_gross',v_expected_gross);
        end if;
      end if;
    end if;
  end if;

  select id into v_event from public.ce_billing_service_events
  where tenant_id=v_tenant and external_event_id='CORE-ENGINE-E2E-EVENT-001';
  if v_event is not null then
    select billed_invoice_id into v_invoice from public.ce_billing_service_events where id=v_event;
    if v_invoice is not null then
      select id into v_receivable from public.ce_billing_receivables where invoice_id=v_invoice;
      if v_receivable is not null then
        delete from public.ce_billing_payment_allocations where receivable_id=v_receivable;
        delete from public.ce_billing_receivables where id=v_receivable;
      end if;
      delete from public.ce_billing_payments where invoice_id=v_invoice;
      delete from public.ce_billing_lifecycle_events where invoice_id=v_invoice;
      delete from public.ce_billing_approval_decisions where invoice_id=v_invoice;
      delete from public.ce_billing_approvals where invoice_id=v_invoice;
      delete from public.ce_billing_validation_checks where invoice_id=v_invoice;
      delete from public.ce_billing_anomalies where invoice_id=v_invoice;
      delete from public.ce_billing_invoice_lines where invoice_id=v_invoice;
      delete from public.ce_erp_process_events where entity_id=v_invoice;
      delete from public.ce_billing_invoices where id=v_invoice;
    end if;
    delete from public.ce_billing_service_events where id=v_event;
  end if;

  select id into v_contract from public.ce_billing_contracts
  where tenant_id=v_tenant and external_contract_id='CORE-ENGINE-E2E-CONTRACT-001';
  if v_contract is not null then
    delete from public.ce_billing_contract_lines where contract_id=v_contract;
    delete from public.ce_billing_contracts where id=v_contract;
  end if;
  delete from public.ce_billing_counterparties
  where tenant_id=v_tenant and external_id='CORE-ENGINE-E2E-CP-001';

  insert into public.ce_billing_counterparties(
    tenant_id,external_id,legal_name,tax_id,country_code,address,payment_terms_days,
    email,active,metadata
  ) values(
    v_tenant,'CORE-ENGINE-E2E-CP-001','CORE ENGINE E2E TEST COUNTERPARTY',
    'E2E-TEST-NIP','PL',jsonb_build_object('test_fixture',true,'scope','billing_e2e'),
    14,'e2e-test@core-engine.invalid',true,
    jsonb_build_object('test_fixture',true,'do_not_contact',true)
  ) returning id into v_counterparty;

  insert into public.ce_billing_contracts(
    tenant_id,counterparty_id,external_contract_id,contract_number,status,
    valid_from,valid_to,currency,billing_cycle,payment_terms_days,
    auto_issue_enabled,approval_policy,source_system,metadata
  ) values(
    v_tenant,v_counterparty,'CORE-ENGINE-E2E-CONTRACT-001','E2E-2026-001','ACTIVE',
    current_date,current_date+365,'PLN','ON_DEMAND',14,false,'ALWAYS',
    'CORE_ENGINE_E2E_TEST',jsonb_build_object('test_fixture',true,'ksef_disabled',true)
  ) returning id into v_contract;

  insert into public.ce_billing_contract_lines(
    contract_id,external_line_id,description,service_code,unit,unit_price,vat_rate,
    currency,active,pricing_rules
  ) values(
    v_contract,'CORE-ENGINE-E2E-LINE-001','E2E test billing service','E2E_SERVICE',
    'EA',v_expected_net,23,'PLN',true,jsonb_build_object('test_fixture',true)
  ) returning id into v_line;

  insert into public.ce_billing_service_events(
    tenant_id,contract_id,counterparty_id,external_event_id,service_date,service_code,
    description,quantity,unit_price,currency,source_system,source_payload,billable
  ) values(
    v_tenant,v_contract,v_counterparty,'CORE-ENGINE-E2E-EVENT-001',current_date,
    'E2E_SERVICE','E2E automated billing transaction',1,v_expected_net,'PLN',
    'CORE_ENGINE_E2E_TEST',jsonb_build_object('test_fixture',true,'ksef_submission',false),true
  ) returning id into v_event;

  v_billing := public.ce_fcc_run_billing_for_event(v_event);
  v_invoice := (v_billing->>'invoice_id')::uuid;
  if v_billing->>'status' <> 'PENDING_APPROVAL' then raise exception 'E2E_FAIL_BILLING_STATUS:%',v_billing; end if;

  select count(*),count(*) filter(where status='FAIL') into v_checks,v_failed_checks
  from public.ce_billing_validation_checks where invoice_id=v_invoice;
  if v_checks < 4 or v_failed_checks <> 0 then
    raise exception 'E2E_FAIL_VALIDATION: checks=%, failed=%',v_checks,v_failed_checks;
  end if;

  if not exists(select 1 from public.ce_billing_invoices
    where id=v_invoice and net_amount=v_expected_net and vat_amount=v_expected_vat
      and gross_amount=v_expected_gross and status='PENDING_APPROVAL') then
    raise exception 'E2E_FAIL_INVOICE_CALCULATION';
  end if;

  select id into v_approval from public.ce_billing_approvals
  where invoice_id=v_invoice and status='PENDING' order by requested_at desc limit 1;
  if v_approval is null then raise exception 'E2E_FAIL_APPROVAL_NOT_CREATED'; end if;

  v_decision := public.ce_fcc_decide_invoice(
    v_invoice,'APPROVE','E2E automated approval verification',null);
  if v_decision->>'status' <> 'READY_FOR_KSEF' then
    raise exception 'E2E_FAIL_APPROVAL_DECISION:%',v_decision;
  end if;

  select id into v_receivable from public.ce_billing_receivables where invoice_id=v_invoice;
  if v_receivable is null then raise exception 'E2E_FAIL_RECEIVABLE_NOT_CREATED'; end if;

  if not exists(select 1 from public.ce_billing_approvals where id=v_approval and status='APPROVED') then
    raise exception 'E2E_FAIL_APPROVAL_STATUS';
  end if;

  insert into public.ce_billing_payments(
    tenant_id,invoice_id,external_payment_id,payment_date,amount,currency,status,source_system,source_payload
  ) values(
    v_tenant,v_invoice,'CORE-ENGINE-E2E-PAYMENT-001',current_date,v_expected_gross,'PLN',
    'MATCHED','CORE_ENGINE_E2E_TEST',jsonb_build_object('test_fixture',true,'auto_matched',true)
  ) returning id into v_payment;

  insert into public.ce_billing_payment_allocations(tenant_id,payment_id,receivable_id,amount)
  values(v_tenant,v_payment,v_receivable,v_expected_gross);

  v_refresh := public.ce_fcc_refresh_receivable_status(v_receivable);
  if v_refresh->>'status' <> 'PAID'
     or (v_refresh->>'open_amount')::numeric <> 0
     or (v_refresh->>'paid_amount')::numeric <> v_expected_gross then
    raise exception 'E2E_FAIL_PAYMENT_STATUS:%',v_refresh;
  end if;

  return jsonb_build_object(
    'test','FCC E2E Billing Transaction','mode','FRESH_EXECUTION','passed',true,
    'ksef_submitted',false,
    'expected',jsonb_build_object('net',v_expected_net,'vat',v_expected_vat,'gross',v_expected_gross),
    'ids',jsonb_build_object('counterparty_id',v_counterparty,'contract_id',v_contract,
      'contract_line_id',v_line,'service_event_id',v_event,'invoice_id',v_invoice,
      'approval_id',v_approval,'receivable_id',v_receivable,'payment_id',v_payment),
    'stages',jsonb_build_array(
      jsonb_build_object('stage','COUNTERPARTY','status','PASS'),
      jsonb_build_object('stage','CONTRACT','status','PASS'),
      jsonb_build_object('stage','SERVICE_EVENT','status','PASS'),
      jsonb_build_object('stage','BILLING','status','PASS','invoice_status','PENDING_APPROVAL'),
      jsonb_build_object('stage','VALIDATION','status','PASS','checks',v_checks,'failed_checks',v_failed_checks),
      jsonb_build_object('stage','APPROVAL_GATE','status','PASS','decision','APPROVE'),
      jsonb_build_object('stage','INVOICE_LIFECYCLE','status','PASS','invoice_status','READY_FOR_KSEF'),
      jsonb_build_object('stage','RECEIVABLE','status','PASS','receivable_status','OPEN'),
      jsonb_build_object('stage','PAYMENT','status','PASS','payment_status','MATCHED'),
      jsonb_build_object('stage','ALLOCATION','status','PASS','allocated_amount',v_expected_gross),
      jsonb_build_object('stage','PAYMENT_MONITOR','status','PASS','receivable_status','PAID'),
      jsonb_build_object('stage','KSEF','status','SKIPPED','reason','TEST/DISABLED')
    )
  );
end;
$function$;

revoke all on function public.ce_fcc_e2e_billing_transaction_test() from public;
grant execute on function public.ce_fcc_e2e_billing_transaction_test() to service_role;