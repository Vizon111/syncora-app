-- =============================================================================
-- Syncora — Migration 0003: Documents, versions, RAG chunks, comments, files
-- =============================================================================

-- ---------------------------------------------------------------------------
-- DOCUMENTS (Yjs / CRDT knowledge layer)
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    project_id uuid references public.projects(id) on delete set null,
    title varchar(500) not null,
    emoji varchar(32) default '📄',
    raw_text text not null default '',
    content_delta bytea, -- binary Yjs snapshot
    version int not null default 1,
    is_locked boolean not null default false,
    author_id uuid references public.users(id) on delete set null,
    last_edited_by_id uuid references public.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_docs_tenant on public.documents(workspace_id);
create index if not exists idx_docs_project on public.documents(project_id);

create table if not exists public.document_versions (
    id uuid primary key default uuid_generate_v4(),
    document_id uuid not null references public.documents(id) on delete cascade,
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    version int not null,
    author_id uuid references public.users(id) on delete set null,
    title varchar(500) not null,
    snapshot_text text not null,
    change_summary varchar(255),
    created_at timestamptz not null default now()
);
create index if not exists idx_doc_versions on public.document_versions(document_id, version desc);

-- ---------------------------------------------------------------------------
-- DOCUMENT CHUNKS & VECTOR EMBEDDINGS (RAG)
-- Gemini text-embedding-004 / embedding-001 produce 768-dim vectors.
-- ---------------------------------------------------------------------------
create table if not exists public.document_chunks (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    document_id uuid not null references public.documents(id) on delete cascade,
    document_title varchar(500) not null default '',
    chunk_index int not null,
    text_content text not null,
    embedding vector(768),
    token_count int not null default 0,
    created_at timestamptz not null default now()
);
create index if not exists idx_chunks_tenant on public.document_chunks(workspace_id);
-- HNSW index for cosine similarity search, scoped per workspace via the
-- idx_chunks_tenant index above being used as a pre-filter by the planner.
create index if not exists idx_chunks_vector on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- COMMENTS & REPLIES
-- ---------------------------------------------------------------------------
create table if not exists public.comments (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    target_type varchar(32) not null check (target_type in ('document', 'task')),
    target_id uuid not null,
    author_id uuid not null references public.users(id) on delete cascade,
    content text not null,
    resolved boolean not null default false,
    resolved_by_id uuid references public.users(id) on delete set null,
    resolved_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_comments_target on public.comments(workspace_id, target_type, target_id);

create table if not exists public.comment_replies (
    id uuid primary key default uuid_generate_v4(),
    comment_id uuid not null references public.comments(id) on delete cascade,
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    author_id uuid not null references public.users(id) on delete cascade,
    content text not null,
    created_at timestamptz not null default now()
);
create index if not exists idx_replies_comment on public.comment_replies(comment_id);

-- ---------------------------------------------------------------------------
-- FILES
-- ---------------------------------------------------------------------------
create table if not exists public.files (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    project_id uuid references public.projects(id) on delete set null,
    name varchar(500) not null,
    file_size bigint not null,
    mime_type varchar(128) not null,
    storage_path text,
    extracted_text text,
    is_indexed_for_rag boolean not null default false,
    uploaded_by_id uuid references public.users(id) on delete set null,
    created_at timestamptz not null default now()
);
create index if not exists idx_files_tenant on public.files(workspace_id);

create trigger trg_documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();
create trigger trg_comments_touch before update on public.comments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_chunks enable row level security;
alter table public.comments enable row level security;
alter table public.comment_replies enable row level security;
alter table public.files enable row level security;

create policy docs_select_member on public.documents
  for select using (public.is_workspace_member(workspace_id));
create policy docs_insert_member on public.documents
  for insert with check (public.has_min_role(workspace_id, 'member'));
create policy docs_update_member on public.documents
  for update using (public.has_min_role(workspace_id, 'member'));
create policy docs_delete_member on public.documents
  for delete using (public.has_min_role(workspace_id, 'member'));

create policy doc_versions_select_member on public.document_versions
  for select using (public.is_workspace_member(workspace_id));
create policy doc_versions_insert_member on public.document_versions
  for insert with check (public.has_min_role(workspace_id, 'member'));

-- Chunks are never written directly by the client; the server (service role)
-- performs indexing. Members may only read chunks in their own workspace —
-- this is the tenant boundary that keeps RAG retrieval from leaking across
-- workspaces.
create policy chunks_select_member on public.document_chunks
  for select using (public.is_workspace_member(workspace_id));

create policy comments_select_member on public.comments
  for select using (public.is_workspace_member(workspace_id));
create policy comments_insert_member on public.comments
  for insert with check (public.has_min_role(workspace_id, 'member'));
create policy comments_update_member on public.comments
  for update using (public.has_min_role(workspace_id, 'member'));
create policy comments_delete_admin_or_author on public.comments
  for delete using (
    author_id = auth.uid() or public.has_min_role(workspace_id, 'admin')
  );

create policy replies_select_member on public.comment_replies
  for select using (public.is_workspace_member(workspace_id));
create policy replies_insert_member on public.comment_replies
  for insert with check (public.has_min_role(workspace_id, 'member'));

create policy files_select_member on public.files
  for select using (public.is_workspace_member(workspace_id));
create policy files_insert_member on public.files
  for insert with check (public.has_min_role(workspace_id, 'member'));
create policy files_delete_member on public.files
  for delete using (public.has_min_role(workspace_id, 'member'));
