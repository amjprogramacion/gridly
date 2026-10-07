begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000001','gridly-delete-a@example.invalid'),
 ('00000000-0000-4000-8000-000000000002','gridly-delete-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
declare
 pid uuid := '00000000-0000-4000-8000-000000000010';
 doc jsonb := '{"version":6,"units":"mm","projectName":"Delete validation","room":null,"objects":[]}';
 r jsonb;
begin
 perform public.gridly_save_project(pid,null,gen_random_uuid(),doc);
 r := public.gridly_set_project_deleted(pid,2,true);
 if r->>'status' <> 'conflict' then raise exception 'Stale deletion accepted'; end if;
 r := public.gridly_set_project_deleted(pid,1,true);
 if r->>'revision' <> '2' then raise exception 'Deletion failed'; end if;
 if not exists(select 1 from public.gridly_projects where id=pid and deleted_at is not null) then raise exception 'Missing tombstone'; end if;
 if public.gridly_set_project_deleted(pid,1,true) <> r then raise exception 'Deletion retry failed'; end if;
 r := public.gridly_save_project(pid,null,gen_random_uuid(),doc);
 if r->>'status' <> 'missing' then raise exception 'Deleted project resurrected'; end if;
 r := public.gridly_set_project_deleted(pid,2,false);
 if r->>'revision' <> '3' then raise exception 'Restore failed'; end if;
 r := public.gridly_save_project(pid,3,gen_random_uuid(),doc);
 if r->>'revision' <> '4' then raise exception 'Save after restoration failed'; end if;
end;
$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$
begin
 begin
  perform public.gridly_set_project_deleted('00000000-0000-4000-8000-000000000010',4,true);
  raise exception 'Foreign deletion allowed';
 exception when insufficient_privilege then null; end;
end;
$$;
set local role anon;
do $$
begin
 begin
  perform public.gridly_set_project_deleted(gen_random_uuid(),1,true);
  raise exception 'Anonymous deletion allowed';
 exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
