-- WhipGuides — Full Database Migration
-- Run this in your Supabase dashboard: https://supabase.com/dashboard
-- Project → SQL Editor → New query → paste this → Run

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- ============================================================
create table if not exists public.users (
  id                bigint primary key generated always as identity,
  username          text not null unique,
  display_name      text not null,
  avatar            text,
  bio               text,
  location          text,
  member_since      text not null default to_char(now(), 'Mon YYYY'),
  rating            real default 0,
  review_count      integer default 0,
  verified          boolean default false,
  response_time     text default 'Usually within a few hours',
  -- Auth fields (linked to Supabase Auth)
  auth_id           uuid unique references auth.users(id) on delete cascade,
  email             text unique,
  created_at        timestamptz default now()
);

-- ============================================================
-- LISTINGS TABLE
-- ============================================================
create table if not exists public.listings (
  id          bigint primary key generated always as identity,
  title       text not null,
  description text not null,
  price       integer not null,
  category    text not null,
  condition   text not null,
  location    text not null,
  year        integer,
  make        text,
  model       text,
  mileage     integer,
  images      text[] default '{}',
  seller_id   bigint not null references public.users(id) on delete cascade,
  status      text default 'active' check (status in ('active', 'sold', 'pending', 'draft')),
  views       integer default 0,
  saves       integer default 0,
  created_at  timestamptz default now(),
  featured    boolean default false
);

-- ============================================================
-- GROUPS TABLE
-- ============================================================
create table if not exists public.groups (
  id           bigint primary key generated always as identity,
  name         text not null,
  description  text not null,
  category     text not null,
  cover_image  text,
  member_count integer default 0,
  post_count   integer default 0,
  owner_id     bigint not null references public.users(id) on delete cascade,
  private      boolean default false,
  created_at   timestamptz default now()
);

-- ============================================================
-- POSTS TABLE (group posts)
-- ============================================================
create table if not exists public.posts (
  id            bigint primary key generated always as identity,
  group_id      bigint not null references public.groups(id) on delete cascade,
  author_id     bigint not null references public.users(id) on delete cascade,
  content       text not null,
  images        text[] default '{}',
  likes         integer default 0,
  comment_count integer default 0,
  created_at    timestamptz default now()
);

-- ============================================================
-- REVIEWS TABLE
-- ============================================================
create table if not exists public.reviews (
  id          bigint primary key generated always as identity,
  reviewer_id bigint not null references public.users(id) on delete cascade,
  reviewee_id bigint not null references public.users(id) on delete cascade,
  listing_id  bigint references public.listings(id) on delete set null,
  rating      integer not null check (rating >= 1 and rating <= 5),
  comment     text not null,
  type        text not null check (type in ('buyer', 'seller')),
  created_at  timestamptz default now()
);

-- ============================================================
-- MESSAGES TABLE (for Phase 3 real-time messaging)
-- ============================================================
create table if not exists public.messages (
  id          bigint primary key generated always as identity,
  sender_id   bigint not null references public.users(id) on delete cascade,
  receiver_id bigint not null references public.users(id) on delete cascade,
  listing_id  bigint references public.listings(id) on delete set null,
  content     text not null,
  read        boolean default false,
  created_at  timestamptz default now()
);

-- ============================================================
-- SAVED LISTINGS TABLE (user bookmarks)
-- ============================================================
create table if not exists public.saved_listings (
  user_id    bigint not null references public.users(id) on delete cascade,
  listing_id bigint not null references public.listings(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, listing_id)
);

-- ============================================================
-- GROUP MEMBERS TABLE
-- ============================================================
create table if not exists public.group_members (
  user_id    bigint not null references public.users(id) on delete cascade,
  group_id   bigint not null references public.groups(id) on delete cascade,
  role       text default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at  timestamptz default now(),
  primary key (user_id, group_id)
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
create index if not exists idx_listings_category on public.listings(category);
create index if not exists idx_listings_status on public.listings(status);
create index if not exists idx_listings_seller_id on public.listings(seller_id);
create index if not exists idx_listings_created_at on public.listings(created_at desc);
create index if not exists idx_posts_group_id on public.posts(group_id);
create index if not exists idx_reviews_reviewee_id on public.reviews(reviewee_id);
create index if not exists idx_messages_receiver_id on public.messages(receiver_id);
create index if not exists idx_messages_listing_id on public.messages(listing_id);
create index if not exists idx_users_auth_id on public.users(auth_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.users enable row level security;
alter table public.listings enable row level security;
alter table public.groups enable row level security;
alter table public.posts enable row level security;
alter table public.reviews enable row level security;
alter table public.messages enable row level security;
alter table public.saved_listings enable row level security;
alter table public.group_members enable row level security;

-- Public read for most tables
create policy "Public read users" on public.users for select using (true);
create policy "Public read listings" on public.listings for select using (true);
create policy "Public read groups" on public.groups for select using (true);
create policy "Public read posts" on public.posts for select using (true);
create policy "Public read reviews" on public.reviews for select using (true);
create policy "Public read group members" on public.group_members for select using (true);

-- Users can only update their own profile
create policy "Users update own profile" on public.users
  for update using (auth.uid() = auth_id);

-- Sellers can insert/update/delete their own listings
create policy "Insert own listings" on public.listings
  for insert with check (
    seller_id = (select id from public.users where auth_id = auth.uid())
  );
create policy "Update own listings" on public.listings
  for update using (
    seller_id = (select id from public.users where auth_id = auth.uid())
  );
create policy "Delete own listings" on public.listings
  for delete using (
    seller_id = (select id from public.users where auth_id = auth.uid())
  );

-- Group owners can manage groups
create policy "Insert groups" on public.groups
  for insert with check (
    owner_id = (select id from public.users where auth_id = auth.uid())
  );
create policy "Update own groups" on public.groups
  for update using (
    owner_id = (select id from public.users where auth_id = auth.uid())
  );

-- Posts by group members
create policy "Insert posts" on public.posts
  for insert with check (
    author_id = (select id from public.users where auth_id = auth.uid())
  );
create policy "Delete own posts" on public.posts
  for delete using (
    author_id = (select id from public.users where auth_id = auth.uid())
  );

-- Reviews
create policy "Insert reviews" on public.reviews
  for insert with check (
    reviewer_id = (select id from public.users where auth_id = auth.uid())
  );

-- Messages (private — sender or receiver only)
create policy "Read own messages" on public.messages
  for select using (
    sender_id = (select id from public.users where auth_id = auth.uid())
    or receiver_id = (select id from public.users where auth_id = auth.uid())
  );
create policy "Insert messages" on public.messages
  for insert with check (
    sender_id = (select id from public.users where auth_id = auth.uid())
  );
create policy "Mark messages read" on public.messages
  for update using (
    receiver_id = (select id from public.users where auth_id = auth.uid())
  );

-- Saved listings
create policy "Read own saved" on public.saved_listings
  for select using (
    user_id = (select id from public.users where auth_id = auth.uid())
  );
create policy "Insert saved" on public.saved_listings
  for insert with check (
    user_id = (select id from public.users where auth_id = auth.uid())
  );
create policy "Delete saved" on public.saved_listings
  for delete using (
    user_id = (select id from public.users where auth_id = auth.uid())
  );

-- Group members
create policy "Insert group membership" on public.group_members
  for insert with check (
    user_id = (select id from public.users where auth_id = auth.uid())
  );
create policy "Delete group membership" on public.group_members
  for delete using (
    user_id = (select id from public.users where auth_id = auth.uid())
  );

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- This trigger fires when someone signs up via Supabase Auth
-- and creates their public profile automatically
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (auth_id, email, username, display_name, member_since)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    to_char(now(), 'Mon YYYY')
  );
  return new;
end;
$$;

-- Drop trigger if exists to avoid duplicates
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- SEED DATA (demo listings, groups, users for testing)
-- ============================================================

-- Seed users (no auth_id since these are demo accounts)
insert into public.users (username, display_name, avatar, bio, location, member_since, rating, review_count, verified) values
('mikethrottle', 'Mike Throttle', 'https://api.dicebear.com/7.x/avataaars/svg?seed=mike', 'Lifelong gearhead. Bought and sold 50+ vehicles.', 'Phoenix, AZ', 'Jan 2023', 4.9, 47, true),
('sarahspeed', 'Sarah Speed', 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah', 'ATV racer and off-road enthusiast.', 'Denver, CO', 'Mar 2023', 4.7, 23, true),
('dirtbikejoe', 'Joe Ramirez', 'https://api.dicebear.com/7.x/avataaars/svg?seed=joe', 'Weekend warrior. Dirt bikes and trail riding.', 'Austin, TX', 'Jun 2023', 4.5, 12, false)
on conflict (username) do nothing;

-- Seed listings
insert into public.listings (title, description, price, category, condition, location, year, make, model, mileage, seller_id, status, featured, images) values
('2022 Yamaha YZ450F — Race Ready', 'Well-maintained race bike. Fresh top end, new chain/sprockets, Dunlop MX33 tires with 3 rides. Never crashed.', 8500, 'Dirt Bikes', 'Excellent', 'Phoenix, AZ', 2022, 'Yamaha', 'YZ450F', 42, 1, 'active', true, '{}'),
('2021 Can-Am Maverick X3 Turbo', 'Side-by-side in excellent condition. Full cage, harnesses, light bar, winch. 1,200 miles. No issues.', 32000, 'UTVs', 'Excellent', 'Denver, CO', 2021, 'Can-Am', 'Maverick X3', 1200, 2, 'active', true, '{}'),
('2020 Sea-Doo GTX 300 Jet Ski', 'Low hours, garage kept. Includes trailer. Bluetooth audio, 300hp, very fast.', 14500, 'Jet Skis', 'Good', 'Austin, TX', 2020, 'Sea-Doo', 'GTX 300', 45, 3, 'active', false, '{}'),
('2019 Ford F-150 Raptor', 'Fox shocks, Baja mode, panoramic sunroof, tow package. Clean title. No modifications beyond factory.', 54000, 'Trucks', 'Good', 'Phoenix, AZ', 2019, 'Ford', 'F-150 Raptor', 38000, 1, 'active', true, '{}'),
('2023 Honda CRF450R', 'Brand new condition, only 5 hours. Includes factory stand and spare parts kit.', 9800, 'Dirt Bikes', 'Like New', 'Denver, CO', 2023, 'Honda', 'CRF450R', 5, 2, 'active', false, '{}')
on conflict do nothing;

-- Seed groups
insert into public.groups (name, description, category, member_count, post_count, owner_id) values
('Desert Riders AZ', 'Arizona''s largest off-road community. Weekly rides, trail maps, and gear swaps.', 'Off-Road', 2847, 412, 1),
('Jet Ski Nation', 'Everything water sports — racing, recreation, and marketplace for PWC enthusiasts.', 'Jet Skis', 1203, 89, 3),
('Truck Life Collective', 'Trucks, overlanding, towing — mods, builds, and advice from real truck owners.', 'Trucks', 5621, 1047, 1)
on conflict do nothing;

-- ============================================================
-- DONE
-- ============================================================
-- Tables created: users, listings, groups, posts, reviews,
--                 messages, saved_listings, group_members
-- RLS policies: enabled on all tables
-- Trigger: auto-creates user profile on Supabase Auth signup
-- Seed data: 3 demo users, 5 listings, 3 groups
