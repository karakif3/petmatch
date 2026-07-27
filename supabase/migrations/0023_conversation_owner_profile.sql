-- `owner_visibility = 'after_match'` seçeneğinin gerçek karşılığı:
-- aktif konuşmada izin verilen sahip özeti görünür, gizli profil görünmez.

create or replace function get_conversation_owner_profile(p_conversation_id uuid)
returns table (
  user_id       uuid,
  display_name  text,
  avatar_path   text,
  bio           text,
  gender        text,
  age_bucket    text,
  social_open   boolean,
  verified      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me profiles%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1
    from conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
  ) then
    raise exception 'not a participant of conversation' using errcode = '42501';
  end if;

  select * into v_me from profiles where id = auth.uid();

  return query
  select
    other_profile.id,
    other_profile.display_name,
    other_profile.avatar_url,
    other_profile.bio,
    case
      when v_me.owner_visibility <> 'hidden' and v_me.gender is not null
      then other_profile.gender
    end,
    case
      when v_me.owner_visibility <> 'hidden' and v_me.birth_date is not null
      then owner_age_bucket(other_profile.birth_date)
    end,
    other_profile.owner_social_open,
    other_profile.verification_status = 'approved'
  from conversations c
  join conversation_participants mine
    on mine.conversation_id = c.id and mine.user_id = auth.uid()
  join conversation_participants other
    on other.conversation_id = c.id and other.user_id <> auth.uid()
  join profiles other_profile on other_profile.id = other.user_id
  where c.id = p_conversation_id
    and (
      other_profile.owner_visibility = 'public'
      or (other_profile.owner_visibility = 'after_match' and c.is_active)
    )
  limit 1;
end;
$$;

revoke all on function get_conversation_owner_profile(uuid)
  from public, anon, authenticated;
grant execute on function get_conversation_owner_profile(uuid) to authenticated;
