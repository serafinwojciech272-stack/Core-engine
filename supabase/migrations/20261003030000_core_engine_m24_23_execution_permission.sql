create or replace function public.ce_recovery_execution_permission_read(
  p_tenant_id uuid,
  p_recovery_key text,
  p_approval_id uuid default null
) returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $
declare
  v_row public.ce_recovery_approvals%rowtype;
begin
  if p_tenant_id is null or coalesce(trim(p_recovery_key), '') = '' then
    raise exception using errcode = 'P0001', message = 'RECOVERY_EXECUTION_PERMISSION_QUERY_INVALID';
  end if;

  if p_approval_id is not null then
    select * into v_row
      from public.ce_recovery_approvals
     where id = p_approval_id
       and tenant_id = p_tenant_id
       and recovery_key = p_recovery_key
     limit 1;
  else
    select * into v_row
      from public.ce_recovery_approvals
     where tenant_id = p_tenant_id
       and recovery_key = p_recovery_key
     order by created_at desc
     limit 1;
  end if;

  if not found then return null; end if;

  return jsonb_build_object(
    'approvalId', v_row.id,
    'tenantId', v_row.tenant_id,
    'recoveryKey', v_row.recovery_key,
    'decision', v_row.decision->>'decision',
    'action', v_row.action,
    'executionPermission', v_row.execution_permission,
    'approvedBy', v_row.actor_id,
    'approvedAt', v_row.created_at,
    'decisionHash', v_row.decision_hash
  );
end;
$$;

revoke all on function public.ce_recovery_execution_permission_read(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.ce_recovery_execution_permission_read(uuid, text, uuid)
  to service_role;
