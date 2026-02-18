create extension if not exists "pgcrypto";

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  created_at timestamp default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  repo_url text,
  status text not null default 'active',
  priority integer not null default 0,
  tags text[],
  metadata jsonb default '{}'::jsonb,
  created_at timestamp default now()
);

create index if not exists projects_status_idx on projects (status);
create index if not exists projects_priority_idx on projects (priority);
create index if not exists projects_tags_idx on projects using gin (tags);

create table if not exists content_documents (
  key text primary key,
  payload jsonb not null,
  source_file text,
  updated_at timestamptz default now()
);

create table if not exists portfolio_projects (
  project_key text primary key,
  source text not null,
  external_id bigint,
  slug text,
  title text not null,
  description text,
  body text,
  thumbnail text,
  status text,
  visibility_private boolean not null default false,
  updated_at timestamptz,
  priority_score integer,
  tech text[] not null default '{}'::text[],
  repo_url text,
  github_id bigint,
  links jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists portfolio_projects_source_idx on portfolio_projects (source);
create index if not exists portfolio_projects_slug_idx on portfolio_projects (slug);
create index if not exists portfolio_projects_updated_idx on portfolio_projects (updated_at desc);
create index if not exists portfolio_projects_tech_gin_idx on portfolio_projects using gin (tech);

create table if not exists blog_posts (
  slug text primary key,
  title text not null,
  excerpt text,
  author text,
  content text,
  body text,
  status text,
  visibility_private boolean not null default false,
  featured boolean not null default false,
  draft boolean not null default false,
  thumbnail text,
  load_readme_from_this_repo text,
  categories text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  published_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create index if not exists blog_posts_published_idx on blog_posts (published_at desc);
create index if not exists blog_posts_categories_gin_idx on blog_posts using gin (categories);
create index if not exists blog_posts_tags_gin_idx on blog_posts using gin (tags);

create table if not exists highlights (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tag text,
  year text,
  technologies text[] not null default '{}'::text[],
  description text,
  links jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  raw jsonb not null default '{}'::jsonb
);

create index if not exists highlights_sort_idx on highlights (sort_order asc);

create table if not exists notification_items (
  id text primary key,
  type text,
  title text not null,
  message text not null,
  persistent boolean not null default false,
  tags text[] not null default '{}'::text[],
  occurred_at timestamptz,
  batch_date date,
  source_file text,
  raw jsonb not null default '{}'::jsonb
);

create index if not exists notification_items_occurred_idx on notification_items (occurred_at desc);
create index if not exists notification_items_tags_gin_idx on notification_items using gin (tags);

create table if not exists function_logs (
  id bigserial primary key,
  logged_at timestamptz not null,
  environment text,
  node_version text,
  region text,
  function_instance_id text,
  memory_limit integer,
  success boolean,
  error text,
  stats jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb
);

create index if not exists function_logs_logged_at_idx on function_logs (logged_at desc);
create index if not exists function_logs_success_idx on function_logs (success);
