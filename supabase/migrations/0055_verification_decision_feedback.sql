-- Profil doğrulama sonucu: yapılandırılmış ret nedeni, itiraz ve bildirim olayı.

alter table moderation_items
  add column rejection_reason_code text check (
    rejection_reason_code in ('unclear_photo', 'pet_not_visible', 'owner_not_visible', 'multiple_people', 'edited_photo', 'other')
  ),
  add column appeal_text text check (char_length(appeal_text) between 10 and 1000),
  add column appealed_at timestamptz;

alter table notification_deliveries
  drop constraint notification_deliveries_event_type_check;
alter table notification_deliveries
  add constraint notification_deliveries_event_type_check
  check (event_type in ('match', 'message', 'new_candidate', 'super_like', 'verification'));

drop function if exists review_moderation_item(uuid, moderation_status, text);

create function review_moderation_item(
  p_item_id uuid,
  p_decision moderation_status,
  p_note text default null,
  p_rejection_reason_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item moderation_items%rowtype;
begin
  if not is_moderator() then
    raise exception 'moderator role required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and p_rejection_reason_code not in (
    'unclear_photo', 'pet_not_visible', 'owner_not_visible',
    'multiple_people', 'edited_photo', 'other'
  ) then
    raise exception 'valid rejection reason is required' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and nullif(trim(p_note), '') is null then
    raise exception 'rejection note is required' using errcode = '22023';
  end if;

  update moderation_items
  set
    status = p_decision,
    note = nullif(trim(p_note), ''),
    rejection_reason_code = case when p_decision = 'rejected' then p_rejection_reason_code else null end,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    appeal_text = null,
    appealed_at = null
  where id = p_item_id and status = 'pending'
  returning * into v_item;

  if v_item.id is null then
    raise exception 'pending moderation item not found' using errcode = 'P0002';
  end if;

  if v_item.kind = 'verification' and v_item.subject_user_id is not null then
    update profiles
    set
      verification_status = p_decision,
      verified_at = case when p_decision = 'approved' then now() else null end
    where id = v_item.subject_user_id;
  end if;
end;
$$;

revoke all on function review_moderation_item(uuid, moderation_status, text, text)
  from public, anon, authenticated;
grant execute on function review_moderation_item(uuid, moderation_status, text, text)
  to authenticated;

create function submit_verification_appeal(p_item_id uuid, p_appeal_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text := nullif(trim(p_appeal_text), '');
begin
  if v_text is null or char_length(v_text) not between 10 and 1000 then
    raise exception 'appeal must be 10-1000 characters' using errcode = '22023';
  end if;

  update moderation_items
  set appeal_text = v_text, appealed_at = now()
  where id = p_item_id
    and created_by = auth.uid()
    and kind = 'verification'
    and status = 'rejected'
    and appealed_at is null;

  if not found then
    raise exception 'appealable verification decision not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function submit_verification_appeal(uuid, text) from public, anon;
grant execute on function submit_verification_appeal(uuid, text) to authenticated;
