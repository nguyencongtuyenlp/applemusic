-- ============================================================
-- Âm Nhạc — Supabase schema (thư viện CHUNG, KHÔNG đăng nhập)
-- Chạy 1 lần trong: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- 1) Bảng bài hát (chỉ metadata + ảnh bìa base64; KHÔNG chứa file nhạc)
create table if not exists public.songs (
  id              text primary key,
  type            text not null default 'youtube',   -- 'youtube' | 'file'
  yt_id           text,
  title           text not null default '',
  artist          text not null default '',
  album           text default '',
  cover_url       text,            -- thumbnail YouTube / ảnh từ URL
  cover_data      text,            -- ảnh bìa tự tải lên, lưu base64 (data URL)
  favorite        boolean default false,
  play_count      integer default 0,
  duration        real default 0,
  added_at        bigint,
  last_played_at  bigint
);

-- 2) Bảng playlist
create table if not exists public.playlists (
  id          text primary key,
  name        text not null default 'Playlist',
  song_ids    jsonb not null default '[]'::jsonb,
  created_at  bigint
);

-- 3) Key-value (recents, hàng đợi gần nhất, cờ seed…)
create table if not exists public.kv (
  key    text primary key,
  value  jsonb
);

-- ============================================================
-- RLS: thư viện chung, cho phép anon (key công khai) đọc + ghi.
-- (App không có đăng nhập nên ai có link cũng thêm/sửa được —
--  đúng như lựa chọn "thư viện chung". Muốn khoá lại thì xem ghi chú cuối file.)
-- ============================================================
alter table public.songs     enable row level security;
alter table public.playlists enable row level security;
alter table public.kv        enable row level security;

drop policy if exists "public songs"     on public.songs;
drop policy if exists "public playlists" on public.playlists;
drop policy if exists "public kv"        on public.kv;

create policy "public songs"     on public.songs     for all using (true) with check (true);
create policy "public playlists" on public.playlists for all using (true) with check (true);
create policy "public kv"        on public.kv        for all using (true) with check (true);

-- ============================================================
-- (TUỲ CHỌN) Khoá chỉ-đọc cho khách, chỉ bạn mới ghi được:
-- thay 3 policy "for all" ở trên bằng cặp dưới đây, rồi dùng
-- Supabase Auth để đăng nhập tài khoản của bạn khi muốn chỉnh sửa.
--
--   create policy "read all"  on public.songs for select using (true);
--   create policy "write auth" on public.songs for all
--     using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- (lặp lại cho playlists, kv) — phần này cần thêm bước đăng nhập trong app.
-- ============================================================
