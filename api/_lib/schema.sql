create table if not exists users (
  id           bigint primary key,
  login        text not null,
  name         text,
  avatar_url   text,
  role         text not null default 'member' check (role in ('root', 'member')),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

create unique index if not exists users_single_root on users (role) where role = 'root';

create table if not exists settings (
  id           boolean primary key default true check (id),
  repo_owner   text,
  repo_name    text,
  branch       text,
  github_token text,
  updated_at   timestamptz not null default now()
);

create table if not exists invitations (
  login      text primary key,
  github_id  bigint,
  avatar_url text,
  invited_by bigint references users(id),
  created_at timestamptz not null default now()
);

create table if not exists threads (
  id          uuid primary key default gen_random_uuid(),
  path        text not null,
  kind        text not null,
  anchor      jsonb,
  base_sha    text,
  status      text not null default 'open' check (status in ('open', 'resolved')),
  created_by  bigint not null references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  resolved_by bigint references users(id),
  resolved_at timestamptz
);

alter table threads drop constraint if exists threads_kind_check;
alter table threads add constraint threads_kind_check check (kind in ('passage', 'proposal'));

create index if not exists threads_path_idx on threads (path, status);
create index if not exists threads_updated_idx on threads (updated_at desc);

create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references threads(id) on delete cascade,
  author_id  bigint not null references users(id),
  kind       text not null default 'text' check (kind in ('text', 'event')),
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_thread_idx on messages (thread_id, created_at);

create table if not exists proposals (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references threads(id) on delete cascade,
  path         text not null,
  action       text not null,
  title        text,
  base_sha     text,
  base_content text,
  content      text,
  status       text not null default 'pending',
  error        text,
  author_id    bigint not null references users(id),
  decided_by   bigint references users(id),
  decided_at   timestamptz,
  commit_sha   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table proposals drop constraint if exists proposals_thread_id_key;
alter table proposals drop constraint if exists proposals_action_check;
alter table proposals add constraint proposals_action_check check (action in ('edit', 'create', 'delete', 'replace'));
alter table proposals drop constraint if exists proposals_status_check;
alter table proposals add constraint proposals_status_check
  check (status in ('pending', 'applying', 'applied', 'rejected', 'withdrawn', 'conflict', 'discarded'));

create index if not exists proposals_thread_idx on proposals (thread_id);
create index if not exists proposals_status_idx on proposals (status, updated_at desc);
create index if not exists proposals_path_idx on proposals (path, status);

create table if not exists approvals (
  proposal_id uuid not null references proposals(id) on delete cascade,
  user_id     bigint not null references users(id),
  created_at  timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

create table if not exists alerts (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('passage_changed', 'file_deleted')),
  path       text not null,
  thread_id  uuid references threads(id) on delete set null,
  details    jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists alert_views (
  alert_id uuid not null references alerts(id) on delete cascade,
  user_id  bigint not null references users(id),
  primary key (alert_id, user_id)
);
