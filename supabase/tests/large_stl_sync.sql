-- No real project data is changed; all fixtures roll back.
begin;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000091','gridly-large-stl@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
do $$
declare
 vertices jsonb;
 document jsonb;
 result jsonb;
 pid uuid := '00000000-0000-4000-8000-000000000092';
 operation uuid := '00000000-0000-4000-8000-000000000093';
begin
 select jsonb_agg(case when n%2=0 then 0.5 else -0.5 end) into vertices from generate_series(1,900000) n;
 document:=jsonb_build_object('version',6,'units','mm','projectName','Large STL regression','room',null,'collisions',false,'objects',jsonb_build_array(jsonb_build_object('id','large','name','large','type','box','x',0,'y',0,'z',0,'width',600,'height',500,'depth',400,'color','#779b8e','collisions',false,'stl',vertices)));
 if octet_length(document::text)<=2097152 then raise exception 'Fixture does not exceed previous limit';end if;
 result:=public.gridly_save_project(pid,null,operation,document);
 if result->>'status'<>'saved' then raise exception 'Large STL rejected';end if;
 if public.gridly_save_project(pid,null,operation,document)<>result then raise exception 'Retry not idempotent';end if;
 if (select p.document->'objects'->0->'stl' from public.gridly_projects p where p.id=pid)<>vertices then raise exception 'Geometry not preserved';end if;
 begin
  perform public.gridly_save_project(gen_random_uuid(),null,gen_random_uuid(),document||'{"units":"m"}'::jsonb);
  raise exception 'Invalid format accepted';
 exception when invalid_parameter_value then null;end;
end;
$$;
reset role;
rollback;
