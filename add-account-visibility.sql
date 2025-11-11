alter table if exists user_profiles
  add column if not exists is_private boolean not null default false;
