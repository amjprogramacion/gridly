-- Documents keep Gridly JSON v6. Cloud revisions are independent counters.
create schema if not exists gridly_private;
revoke all on schema gridly_private from public, anon;
grant usage on schema gridly_private to authenticated;

create table public.gridly_projects (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  document jsonb not null,
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default now()
);
create index gridly_projects_owner_updated_idx on public.gridly_projects(owner_id, updated_at desc);
create table public.gridly_project_revisions (
  project_id uuid not null references public.gridly_projects(id) on delete cascade,
  revision bigint not null check (revision > 0),
  owner_id uuid not null references auth.users(id) on delete cascade,
  document jsonb not null,
  created_at timestamptz not null default now(),
  primary key(project_id, revision)
);
create index gridly_revisions_owner_idx on public.gridly_project_revisions(owner_id);
create table gridly_private.project_operations (
  project_id uuid not null references public.gridly_projects(id) on delete cascade,
  operation_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  expected_revision bigint,
  document_hash bytea not null,
  result jsonb not null,
  primary key(project_id, operation_id)
);
create index gridly_operations_owner_idx on gridly_private.project_operations(owner_id);

alter table public.gridly_projects enable row level security;
alter table public.gridly_project_revisions enable row level security;
alter table gridly_private.project_operations enable row level security;
create policy projects_read_own on public.gridly_projects for select to authenticated using ((select auth.uid()) = owner_id);
create policy revisions_read_own on public.gridly_project_revisions for select to authenticated using ((select auth.uid()) = owner_id);
-- There are deliberately no direct client INSERT/UPDATE/DELETE privileges.
revoke all on public.gridly_projects, public.gridly_project_revisions, gridly_private.project_operations from public, anon, authenticated;
grant select on public.gridly_projects, public.gridly_project_revisions to authenticated;

-- Privileged implementation is outside the exposed API schema. It must write
-- without granting clients an UPDATE path that bypasses revision checks.
create function gridly_private.save_project(p_project_id uuid, p_expected_revision bigint, p_operation_id uuid, p_document jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  current_project public.gridly_projects%rowtype;
  operation gridly_private.project_operations%rowtype;
  document_hash bytea;
  result jsonb;
  next_revision bigint;
  saved_at timestamptz := clock_timestamp();
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_project_id is null or p_operation_id is null or p_expected_revision < 1 then
    raise exception 'Invalid save parameters' using errcode = '22023';
  end if;
  if p_document is null or jsonb_typeof(p_document) is distinct from 'object'
    or p_document->'version' is distinct from '6'::jsonb
    or p_document->>'units' is distinct from 'mm'
    or jsonb_typeof(p_document->'objects') is distinct from 'array'
    or not (p_document ? 'room')
    or jsonb_typeof(p_document->'projectName') is distinct from 'string'
    or length(btrim(p_document->>'projectName')) not between 1 and 120
    or p_document ? 'customDraft'
    or octet_length(p_document::text) > 2097152 then
    raise exception 'Invalid Gridly document (maximum 2 MB)' using errcode = '22023';
  end if;
  document_hash := sha256(convert_to(p_document::text, 'UTF8'));
  -- Serializes creation and saves for one ID, including concurrent retries.
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));
  select * into current_project from public.gridly_projects where id = p_project_id;
  if found and current_project.owner_id <> uid then
    raise exception 'Project unavailable' using errcode = '42501';
  end if;
  select * into operation from gridly_private.project_operations
    where project_id = p_project_id and operation_id = p_operation_id and owner_id = uid;
  if found then
    if operation.document_hash <> document_hash or operation.expected_revision is distinct from p_expected_revision then
      raise exception 'Operation already used with different content' using errcode = '22023';
    end if;
    return operation.result;
  end if;
  if current_project.id is null then
    if p_expected_revision is not null then return jsonb_build_object('status', 'missing'); end if;
    next_revision := 1;
    insert into public.gridly_projects(id, owner_id, document, revision, updated_at)
      values(p_project_id, uid, p_document, next_revision, saved_at);
  else
    if current_project.revision is distinct from p_expected_revision then
      return jsonb_build_object('status', 'conflict', 'revision', current_project.revision,
        'document', current_project.document, 'updated_at', current_project.updated_at);
    end if;
    next_revision := current_project.revision + 1;
    update public.gridly_projects set document = p_document, revision = next_revision, updated_at = saved_at where id = p_project_id and owner_id = uid;
  end if;
  insert into public.gridly_project_revisions(project_id, revision, owner_id, document, created_at)
    values(p_project_id, next_revision, uid, p_document, saved_at);
  result := jsonb_build_object('status', 'saved', 'revision', next_revision, 'updated_at', saved_at);
  insert into gridly_private.project_operations(project_id, operation_id, owner_id, expected_revision, document_hash, result)
    values(p_project_id, p_operation_id, uid, p_expected_revision, document_hash, result);
  return result;
end;
$$;
revoke all on function gridly_private.save_project(uuid, bigint, uuid, jsonb) from public, anon, authenticated;
grant execute on function gridly_private.save_project(uuid, bigint, uuid, jsonb) to authenticated;

create function public.gridly_save_project(p_project_id uuid, p_expected_revision bigint, p_operation_id uuid, p_document jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select gridly_private.save_project(p_project_id, p_expected_revision, p_operation_id, p_document);
$$;
revoke all on function public.gridly_save_project(uuid, bigint, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.gridly_save_project(uuid, bigint, uuid, jsonb) to authenticated;

-- Realtime is a hint; clients still re-read and check revisions after reconnect.
alter publication supabase_realtime add table public.gridly_projects;
notify pgrst, 'reload schema';
