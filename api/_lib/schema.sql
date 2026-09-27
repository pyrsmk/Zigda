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
  kind        text not null check (kind in ('comment', 'suggestion', 'proposal')),
  anchor      jsonb,
  base_sha    text,
  status      text not null default 'open' check (status in ('open', 'resolved')),
  created_by  bigint not null references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  resolved_by bigint references users(id),
  resolved_at timestamptz
);

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
  thread_id    uuid not null unique references threads(id) on delete cascade,
  path         text not null,
  action       text not null check (action in ('edit', 'create', 'delete', 'replace')),
  title        text,
  base_sha     text,
  base_content text,
  content      text,
  status       text not null default 'pending'
               check (status in ('pending', 'applying', 'applied', 'rejected', 'withdrawn', 'conflict')),
  error        text,
  author_id    bigint not null references users(id),
  decided_by   bigint references users(id),
  decided_at   timestamptz,
  commit_sha   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists proposals_status_idx on proposals (status, updated_at desc);
create index if not exists proposals_path_idx on proposals (path, status);

create table if not exists approvals (
  proposal_id uuid not null references proposals(id) on delete cascade,
  user_id     bigint not null references users(id),
  created_at  timestamptz not null default now(),
  primary key (proposal_id, user_id)
);
