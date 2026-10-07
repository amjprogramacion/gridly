-- Transactional fixtures: no real accounts, emails or project data survive.
begin;
insert into auth.users(id, email) values
 ('00000000-0000-4000-8000-000000000001', 'gridly-sql-a@example.invalid'),
 ('00000000-0000-4000-8000-000000000002', 'gridly-sql-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $$
declare
  pid uuid := '00000000-0000-4000-8000-000000000010';
  op uuid := '00000000-0000-4000-8000-000000000020';
  doc jsonb := '{"version":6,"units":"mm","projectName":"SQL validation","room":null,"objects":[],"collisions":false,"customObjects":[]}';
  result jsonb;
begin
  result := public.gridly_save_project(pid, null, op, doc);
  if result->>'status' <> 'saved' or result->>'revision' <> '1' then raise exception 'Creation failed'; end if;
  if public.gridly_save_project(pid, null, op, doc) <> result then raise exception 'Retry not idempotent'; end if;
  result := public.gridly_save_project(pid, 1, '00000000-0000-4000-8000-000000000021', doc || '{"projectName":"Updated"}');
  if result->>'revision' <> '2' then raise exception 'Revision increment failed'; end if;
  result := public.gridly_save_project(pid, 1, '00000000-0000-4000-8000-000000000022', doc);
  if result->>'status' <> 'conflict' or result->>'revision' <> '2' then raise exception 'Stale save overwrote project'; end if;
  if (select document->>'projectName' from public.gridly_projects where id=pid) <> 'Updated' then raise exception 'Document overwritten'; end if;
  if (select count(*) from public.gridly_project_revisions where project_id=pid) <> 2 then raise exception 'History/retry mismatch'; end if;
  begin
    perform public.gridly_save_project(pid, null, op, doc || '{"projectName":"Wrong reuse"}');
    raise exception 'Operation reuse accepted';
  exception when invalid_parameter_value then null; end;
  begin
    update public.gridly_projects set revision=99 where id=pid;
    raise exception 'Direct update allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.gridly_save_project(pid, 2, gen_random_uuid(), doc || '{"customDraft":{}}');
    raise exception 'Draft accepted in cloud';
  exception when invalid_parameter_value then null; end;
end;
$$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
do $$
begin
  if exists(select 1 from public.gridly_projects) or exists(select 1 from public.gridly_project_revisions) then raise exception 'RLS leaked another account'; end if;
  begin
    perform public.gridly_save_project('00000000-0000-4000-8000-000000000010', 2, gen_random_uuid(), '{"version":6,"units":"mm","projectName":"Intruder","room":null,"objects":[]}');
    raise exception 'Another account updated project';
  exception when insufficient_privilege then null; end;
end;
$$;
set local role anon;
do $$
begin
  begin
    perform public.gridly_save_project(gen_random_uuid(), null, gen_random_uuid(), '{}');
    raise exception 'Anonymous function execution allowed';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
