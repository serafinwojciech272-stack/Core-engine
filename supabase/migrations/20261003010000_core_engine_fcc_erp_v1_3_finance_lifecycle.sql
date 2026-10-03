-- FCC ERP v1.3: Approval Gate -> Invoice Lifecycle -> Receivable -> Accounting -> Payment Monitor
create or replace function public.ce_fcc_post_invoice_accounting(p_invoice_id uuid)
returns jsonb
language plpgsql
set search_path=public
as $$
declare
  v_i public.ce_billing_invoices%rowtype;
  v_period public.ce_fin_periods%rowtype;
  v_ar uuid; v_rev uuid; v_vat uuid; v_journal uuid; v_existing uuid;
begin
  select * into v_i from public.ce_billing_invoices where id=p_invoice_id for update;
  if not found then raise exception 'INVOICE_NOT_FOUND'; end if;

  select id into v_existing from public.ce_fin_journals
  where tenant_id=v_i.tenant_id and source_type='BILLING_INVOICE' and source_id=v_i.id limit 1;
  if v_existing is not null then
    return jsonb_build_object('status','ALREADY_POSTED','journal_id',v_existing,'invoice_id',v_i.id);
  end if;

  select * into v_period from public.ce_fin_periods
  where tenant_id=v_i.tenant_id and v_i.issue_date between starts_on and ends_on and status='OPEN'
  order by starts_on desc limit 1 for update;
  if not found then raise exception 'NO_OPEN_FIN_PERIOD'; end if;

  select id into v_ar from public.ce_fin_accounts where tenant_id=v_i.tenant_id and account_code='201' and active=true;
  select id into v_rev from public.ce_fin_accounts where tenant_id=v_i.tenant_id and account_code='700' and active=true;
  select id into v_vat from public.ce_fin_accounts where tenant_id=v_i.tenant_id and account_code='222' and active=true;
  if v_ar is null or v_rev is null or v_vat is null then raise exception 'MISSING_BILLING_ACCOUNTS'; end if;

  insert into public.ce_fin_journals
    (tenant_id,journal_no,posting_date,period_id,source_type,source_id,status,description,metadata)
  values
    (v_i.tenant_id,'AR-INV-'||replace(v_i.id::text,'-',''),v_i.issue_date,v_period.id,
     'BILLING_INVOICE',v_i.id,'POSTED',
     'Należność i przychód z faktury '||coalesce(v_i.invoice_number,v_i.id::text),
     jsonb_build_object('calculation_version',v_i.calculation_version))
  returning id into v_journal;

  insert into public.ce_fin_journal_lines
    (tenant_id,journal_id,line_no,account_id,debit,credit,currency,description,metadata)
  values
    (v_i.tenant_id,v_journal,1,v_ar,v_i.gross_amount,0,v_i.currency,
     'Rozrachunki odbiorców - '||coalesce(v_i.invoice_number,v_i.id::text),jsonb_build_object('invoice_id',v_i.id)),
    (v_i.tenant_id,v_journal,2,v_rev,0,v_i.net_amount,v_i.currency,
     'Przychód ze sprzedaży - '||coalesce(v_i.invoice_number,v_i.id::text),jsonb_build_object('invoice_id',v_i.id)),
    (v_i.tenant_id,v_journal,3,v_vat,0,v_i.vat_amount,v_i.currency,
     'VAT należny - '||coalesce(v_i.invoice_number,v_i.id::text),jsonb_build_object('invoice_id',v_i.id));

  if not exists (
    select 1 from public.ce_fin_journal_lines where journal_id=v_journal
    group by journal_id having sum(debit) = sum(credit)
  ) then raise exception 'ACCOUNTING_UNBALANCED'; end if;

  insert into public.ce_billing_audit_events
    (tenant_id,entity_type,entity_id,event_type,actor_type,before_state,after_state,idempotency_key)
  values
    (v_i.tenant_id,'INVOICE',v_i.id,'ACCOUNTING_POSTED','SYSTEM',
     jsonb_build_object('status',v_i.status),jsonb_build_object('status',v_i.status,'journal_id',v_journal),
     'accounting:invoice:'||v_i.id::text)
  on conflict do nothing;

  insert into public.ce_erp_process_events
    (tenant_id,process_type,entity_type,entity_id,event_type,idempotency_key,payload)
  values
    (v_i.tenant_id,'ORDER_TO_CASH','INVOICE',v_i.id,'ACCOUNTING_POSTED',
     'accounting:invoice:'||v_i.id::text,jsonb_build_object('journal_id',v_journal,'gross',v_i.gross_amount))
  on conflict (tenant_id,idempotency_key) do nothing;

  return jsonb_build_object('status','POSTED','invoice_id',v_i.id,'journal_id',v_journal);
end;
$$;

revoke all on function public.ce_fcc_post_invoice_accounting(uuid) from public;
grant execute on function public.ce_fcc_post_invoice_accounting(uuid) to service_role;

create or replace function public.ce_fcc_post_payment_accounting(p_allocation_id uuid)
returns jsonb
language plpgsql
set search_path=public
as $$
declare
  v_a public.ce_billing_payment_allocations%rowtype;
  v_p public.ce_billing_payments%rowtype;
  v_r public.ce_billing_receivables%rowtype;
  v_i public.ce_billing_invoices%rowtype;
  v_period public.ce_fin_periods%rowtype;
  v_bank uuid; v_ar uuid; v_journal uuid; v_existing uuid;
begin
  select * into v_a from public.ce_billing_payment_allocations where id=p_allocation_id for update;
  if not found then raise exception 'ALLOCATION_NOT_FOUND'; end if;
  select * into v_p from public.ce_billing_payments where id=v_a.payment_id for update;
  select * into v_r from public.ce_billing_receivables where id=v_a.receivable_id for update;
  if v_p.id is null or v_r.id is null then raise exception 'PAYMENT_OR_RECEIVABLE_NOT_FOUND'; end if;
  select * into v_i from public.ce_billing_invoices where id=v_r.invoice_id;
  if v_i.id is null then raise exception 'INVOICE_NOT_FOUND'; end if;

  select id into v_existing from public.ce_fin_journals
  where tenant_id=v_a.tenant_id and source_type='PAYMENT_ALLOCATION' and source_id=v_a.id limit 1;
  if v_existing is not null then
    return jsonb_build_object('status','ALREADY_POSTED','journal_id',v_existing,'allocation_id',v_a.id);
  end if;

  select * into v_period from public.ce_fin_periods
  where tenant_id=v_a.tenant_id and v_p.payment_date between starts_on and ends_on and status='OPEN'
  order by starts_on desc limit 1 for update;
  if not found then raise exception 'NO_OPEN_FIN_PERIOD'; end if;

  select id into v_bank from public.ce_fin_accounts where tenant_id=v_a.tenant_id and account_code='130' and active=true;
  select id into v_ar from public.ce_fin_accounts where tenant_id=v_a.tenant_id and account_code='201' and active=true;
  if v_bank is null or v_ar is null then raise exception 'MISSING_PAYMENT_ACCOUNTS'; end if;

  insert into public.ce_fin_journals
    (tenant_id,journal_no,posting_date,period_id,source_type,source_id,status,description,metadata)
  values
    (v_a.tenant_id,'AR-PAY-'||replace(v_a.id::text,'-',''),v_p.payment_date,v_period.id,
     'PAYMENT_ALLOCATION',v_a.id,'POSTED',
     'Rozliczenie wpłaty do '||coalesce(v_i.invoice_number,v_i.id::text),
     jsonb_build_object('payment_id',v_p.id,'receivable_id',v_r.id))
  returning id into v_journal;

  insert into public.ce_fin_journal_lines
    (tenant_id,journal_id,line_no,account_id,debit,credit,currency,description,metadata)
  values
    (v_a.tenant_id,v_journal,1,v_bank,v_a.amount,0,v_p.currency,
     'Wpływ bankowy - '||v_p.external_payment_id,jsonb_build_object('payment_id',v_p.id)),
    (v_a.tenant_id,v_journal,2,v_ar,0,v_a.amount,v_p.currency,
     'Rozliczenie należności - '||coalesce(v_i.invoice_number,v_i.id::text),jsonb_build_object('receivable_id',v_r.id));

  insert into public.ce_billing_audit_events
    (tenant_id,entity_type,entity_id,event_type,actor_type,after_state,idempotency_key)
  values
    (v_a.tenant_id,'PAYMENT_ALLOCATION',v_a.id,'PAYMENT_ACCOUNTING_POSTED','SYSTEM',
     jsonb_build_object('journal_id',v_journal,'amount',v_a.amount),
     'accounting:payment-allocation:'||v_a.id::text)
  on conflict do nothing;

  return jsonb_build_object('status','POSTED','allocation_id',v_a.id,'journal_id',v_journal);
end;
$$;

revoke all on function public.ce_fcc_post_payment_accounting(uuid) from public;
grant execute on function public.ce_fcc_post_payment_accounting(uuid) to service_role;

create or replace function public.ce_fcc_decide_invoice(
  p_invoice_id uuid,p_decision text,p_reason text default null,p_actor_id uuid default null
)
returns jsonb
language plpgsql
set search_path=public
as $$
declare
  v_i public.ce_billing_invoices%rowtype;
  v_a public.ce_billing_approvals%rowtype;
  v_old text; v_new text; v_rec uuid; v_accounting jsonb;
begin
  if p_decision not in ('APPROVE','REJECT') then raise exception 'INVALID_DECISION'; end if;
  select * into v_i from public.ce_billing_invoices where id=p_invoice_id for update;
  if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
  v_old:=v_i.status;
  if v_i.status <> 'PENDING_APPROVAL' then raise exception 'INVOICE_NOT_AWAITING_APPROVAL'; end if;

  select * into v_a from public.ce_billing_approvals
  where invoice_id=p_invoice_id and status='PENDING'
  order by requested_at desc limit 1 for update;
  if v_a.id is null then raise exception 'APPROVAL_GATE_MISSING'; end if;

  if p_decision='REJECT' then
    v_new:='REJECTED';
    update public.ce_billing_invoices set status=v_new,updated_at=now() where id=p_invoice_id;
    update public.ce_billing_approvals
      set status='REJECTED',decided_at=now(),decision_note=p_reason,decided_by=p_actor_id where id=v_a.id;
  else
    v_new:='READY_FOR_KSEF';
    update public.ce_billing_approvals
      set status='APPROVED',decided_at=now(),decision_note=p_reason,decided_by=p_actor_id where id=v_a.id;
    update public.ce_billing_invoices
      set status='APPROVED',issue_date=coalesce(issue_date,current_date),
          sale_date=coalesce(sale_date,current_date),due_date=coalesce(due_date,current_date),updated_at=now()
      where id=p_invoice_id;

    v_accounting := public.ce_fcc_post_invoice_accounting(p_invoice_id);
    update public.ce_billing_invoices set status=v_new,updated_at=now() where id=p_invoice_id;

    insert into public.ce_billing_receivables
      (tenant_id,invoice_id,counterparty_id,original_amount,open_amount,due_date,status)
    values
      (v_i.tenant_id,v_i.id,v_i.counterparty_id,v_i.gross_amount,v_i.gross_amount,
       coalesce(v_i.due_date,current_date),'OPEN')
    on conflict(invoice_id) do update set open_amount=excluded.open_amount,status='OPEN'
    returning id into v_rec;
  end if;

  insert into public.ce_billing_approval_decisions
    (tenant_id,invoice_id,approval_id,decision,reason,decided_by)
  values(v_i.tenant_id,v_i.id,v_a.id,p_decision,p_reason,p_actor_id);

  insert into public.ce_billing_lifecycle_events
    (tenant_id,invoice_id,from_status,to_status,event_type,actor_type,actor_id,metadata)
  values
    (v_i.tenant_id,v_i.id,v_old,v_new,'APPROVAL_DECISION',
     case when p_actor_id is null then 'SYSTEM' else 'USER' end,p_actor_id,
     jsonb_build_object('decision',p_decision,'reason',p_reason,'accounting',coalesce(v_accounting,'{}'::jsonb)));

  insert into public.ce_billing_audit_events
    (tenant_id,entity_type,entity_id,event_type,actor_type,actor_id,before_state,after_state,idempotency_key)
  values
    (v_i.tenant_id,'INVOICE',v_i.id,'APPROVAL_DECISION',
     case when p_actor_id is null then 'SYSTEM' else 'USER' end,p_actor_id,
     jsonb_build_object('status',v_old),
     jsonb_build_object('status',v_new,'decision',p_decision,'receivable_id',v_rec),
     'approval:invoice:'||v_i.id::text)
  on conflict do nothing;

  return jsonb_build_object(
    'status',v_new,'invoice_id',v_i.id,'receivable_id',v_rec,'decision',p_decision,
    'accounting',coalesce(v_accounting,'{}'::jsonb)
  );
end;
$$;

revoke all on function public.ce_fcc_decide_invoice(uuid,text,text,uuid) from public;
grant execute on function public.ce_fcc_decide_invoice(uuid,text,text,uuid) to service_role;

create or replace function public.ce_fcc_refresh_receivable_status(p_receivable_id uuid)
returns jsonb
language plpgsql
set search_path=public
as $$
declare
  r public.ce_billing_receivables%rowtype;
  paid numeric(18,2); ns text; x record;
begin
  select * into r from public.ce_billing_receivables where id=p_receivable_id for update;
  if not found then raise exception 'RECEIVABLE_NOT_FOUND'; end if;

  for x in select id from public.ce_billing_payment_allocations where receivable_id=r.id order by allocated_at
  loop
    perform public.ce_fcc_post_payment_accounting(x.id);
  end loop;

  select coalesce(sum(amount),0) into paid from public.ce_billing_payment_allocations where receivable_id=r.id;
  if paid>=r.original_amount then ns:='PAID';
  elsif paid>0 then ns:='PARTIALLY_PAID';
  elsif r.due_date<current_date then ns:='OVERDUE';
  else ns:='OPEN'; end if;

  update public.ce_billing_receivables
  set open_amount=greatest(r.original_amount-paid,0),status=ns,
      closed_at=case when ns='PAID' then coalesce(closed_at,now()) else null end
  where id=r.id;

  return jsonb_build_object('receivable_id',r.id,'status',ns,'paid_amount',paid,
    'open_amount',greatest(r.original_amount-paid,0));
end;
$$;

revoke all on function public.ce_fcc_refresh_receivable_status(uuid) from public;
grant execute on function public.ce_fcc_refresh_receivable_status(uuid) to service_role;
