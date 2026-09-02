-- =============================================================================
-- Syncora — Migration 0005: Auto-create public.users profile on signup (Этап 2)
--
-- When Supabase Auth creates a new row in auth.users (on sign-up), this
-- trigger creates the matching public.users profile row automatically —
-- the standard Supabase pattern for keeping a public profile table in sync
-- with the private auth schema. Without this, a freshly signed-up user
-- would have a valid session but no row in public.users, and every query
-- that joins through workspace_members -> users would silently omit them.
-- =============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_color text;
  v_palette text[] := array['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
begin
  -- Prefer a display name passed in signup metadata (supabase.auth.signUp({
  -- options: { data: { name } } })); fall back to the email local-part.
  v_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  v_color := v_palette[1 + (abs(hashtext(new.id::text)) % array_length(v_palette, 1))];

  insert into public.users (id, email, name, color, status)
  values (new.id, new.email, v_name, v_color, 'online')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Keep public.users.email in sync if it's ever changed via Supabase Auth
-- (email change flow), so app queries don't show a stale address.
-- ---------------------------------------------------------------------------
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();
