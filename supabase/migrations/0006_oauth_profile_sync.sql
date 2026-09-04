-- =============================================================================
-- Syncora — Migration 0006: OAuth-aware profile sync (Google sign-in)
--
-- The 0005 trigger reads raw_user_meta_data->>'name', which is what
-- supabase.auth.signUp({ options: { data: { name } } }) sets for email/
-- password sign-up. OAuth providers use different keys: Google puts the
-- display name under 'full_name' (sometimes also 'name') and the profile
-- photo under 'avatar_url' or 'picture'. Without this, a user who signs up
-- with Google gets their name derived from their email's local-part instead
-- of their real name, and no avatar even though Google provided one.
--
-- This replaces handle_new_auth_user() to check both key styles and also
-- populate avatar_url from the OAuth profile picture when available.
-- =============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_avatar text;
  v_color text;
  v_palette text[] := array['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
begin
  -- Prefer an explicit name from email/password signup metadata, then fall
  -- back to the OAuth provider's display name fields (Google uses
  -- 'full_name', occasionally also exposes 'name'), then the email
  -- local-part as a last resort.
  v_name := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  -- OAuth providers (Google) supply a profile picture under 'avatar_url' or
  -- 'picture'; email/password signups won't have either, which is fine —
  -- the app already falls back to initials when avatar_url is empty.
  v_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    ''
  );

  v_color := v_palette[1 + (abs(hashtext(new.id::text)) % array_length(v_palette, 1))];

  insert into public.users (id, email, name, avatar_url, color, status)
  values (new.id, new.email, v_name, v_avatar, v_color, 'online')
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Trigger already exists from 0005 and points at this function by name, so
-- replacing the function body above is enough — no need to re-create it.
