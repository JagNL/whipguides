-- WhipGuides — Admin & Roles Migration
-- Run in Supabase Dashboard → SQL Editor → New query → Run
-- Run AFTER the initial supabase-migration.sql

-- ============================================================
-- 1. ADD SITE ROLE TO USERS
-- ============================================================
alter table public.users
  add column if not exists site_role text default 'user'
    check (site_role in ('user', 'site_admin', 'super_admin')),
  add column if not exists banned boolean default false,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_reason text;

-- ============================================================
-- 2. UPGRADE GROUP_MEMBERS ROLE OPTIONS
-- ============================================================
-- Drop and recreate check constraint with expanded roles
alter table public.group_members
  drop constraint if exists group_members_role_check;

alter table public.group_members
  add constraint group_members_role_check
    check (role in ('owner', 'admin', 'moderator', 'member'));

-- ============================================================
-- 3. REPORTS TABLE
-- ============================================================
create table if not exists public.reports (
  id           bigint primary key generated always as identity,
  reporter_id  bigint not null references public.users(id) on delete cascade,
  -- What's being reported
  target_type  text not null check (target_type in ('listing', 'post', 'user', 'group', 'message')),
  target_id    bigint not null,
  reason       text not null check (reason in (
    'spam', 'fraud', 'inappropriate', 'illegal_item',
    'harassment', 'misinformation', 'other'
  )),
  description  text,
  status       text default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by  bigint references public.users(id) on delete set null,
  reviewed_at  timestamptz,
  resolution   text,
  created_at   timestamptz default now()
);

alter table public.reports enable row level security;

-- Anyone logged in can submit a report
create policy "Insert reports" on public.reports
  for insert with check (
    reporter_id = (select id from public.users where auth_id = auth.uid())
  );

-- Only admins can read reports (enforced at API level via service role)
create policy "Admin read reports" on public.reports
  for select using (
    exists (
      select 1 from public.users
      where auth_id = auth.uid()
      and site_role in ('site_admin', 'super_admin')
    )
  );

create policy "Admin update reports" on public.reports
  for update using (
    exists (
      select 1 from public.users
      where auth_id = auth.uid()
      and site_role in ('site_admin', 'super_admin')
    )
  );

create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_target on public.reports(target_type, target_id);

-- ============================================================
-- 4. ADMIN ACTIONS AUDIT LOG
-- ============================================================
create table if not exists public.admin_actions (
  id          bigint primary key generated always as identity,
  admin_id    bigint not null references public.users(id) on delete cascade,
  action      text not null,   -- e.g. 'ban_user', 'delete_listing', 'feature_listing'
  target_type text not null,
  target_id   bigint not null,
  notes       text,
  created_at  timestamptz default now()
);

alter table public.admin_actions enable row level security;

create policy "Admin read audit log" on public.admin_actions
  for select using (
    exists (
      select 1 from public.users
      where auth_id = auth.uid()
      and site_role in ('site_admin', 'super_admin')
    )
  );

create policy "Admin insert audit log" on public.admin_actions
  for insert with check (
    admin_id = (select id from public.users where auth_id = auth.uid())
  );

-- ============================================================
-- 5. HELPFUL ADMIN VIEWS
-- ============================================================
create or replace view public.admin_user_summary as
  select
    u.id, u.username, u.display_name, u.email,
    u.site_role, u.verified, u.banned,
    u.rating, u.review_count,
    u.created_at,
    count(distinct l.id) as listing_count,
    count(distinct r.id) as report_count
  from public.users u
  left join public.listings l on l.seller_id = u.id
  left join public.reports r on r.target_id = u.id and r.target_type = 'user'
  group by u.id;

-- ============================================================
-- DONE
-- ============================================================
-- Added: users.site_role, users.banned fields
-- Added: group_members moderator role
-- New tables: reports, admin_actions
-- New view: admin_user_summary
