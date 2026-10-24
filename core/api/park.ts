/**
 * "Şimdi parktayım": eşleşme gerektirmeyen anlık buluşma.
 *
 * Yer yalnız bölgedeki doğrulanmış buluşma yerlerinden seçilir
 * (`listMeetupPlaces`); serbest konum ya da canlı konum yok. Sunucu bölgeyi,
 * engeli ve sahip görünürlüğünü uygular (`20261024160000`).
 */
import type { Size, Species } from "../domain/types";
import { requestNotificationDelivery } from "./notifications";
import { trackProductEvent } from "./observability";
import { requireSupabaseClient } from "./supabase.client";

export const PARK_DURATIONS = [30, 60, 90, 120] as const;

export type ParkCheckin = {
  id: string;
  placeId: string;
  placeName: string;
  petId: string;
  petName: string;
  species: Species;
  size: Size;
  petPhotoUrl: string | null;
  ownerName: string | null;
  endsAt: string;
  isMine: boolean;
};

export type ParkPlaceGroup = {
  placeId: string;
  placeName: string;
  checkins: ParkCheckin[];
};

export async function listParkNow(): Promise<ParkCheckin[]> {
  const sb = requireSupabaseClient();
  const { data, error } = await sb.rpc("list_park_now");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.checkin_id,
    placeId: row.place_id,
    placeName: row.place_name,
    petId: row.pet_id,
    petName: row.pet_name,
    species: row.species,
    size: row.size,
    petPhotoUrl: row.pet_photo_path
      ? sb.storage.from("pet-photos").getPublicUrl(row.pet_photo_path).data.publicUrl
      : null,
    ownerName: row.owner_name,
    endsAt: row.ends_at,
    isMine: row.is_mine,
  }));
}

/** Sunucu sırasını (yer sırası, sonra başlangıç) koruyarak yere göre gruplar. */
export function groupByPlace(checkins: ParkCheckin[]): ParkPlaceGroup[] {
  const groups = new Map<string, ParkPlaceGroup>();
  for (const checkin of checkins) {
    const group = groups.get(checkin.placeId) ?? {
      placeId: checkin.placeId,
      placeName: checkin.placeName,
      checkins: [],
    };
    group.checkins.push(checkin);
    groups.set(checkin.placeId, group);
  }
  return [...groups.values()];
}

export function minutesLeft(endsAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.round((new Date(endsAt).getTime() - now.getTime()) / 60_000));
}

export async function startParkCheckin(input: {
  placeId: string;
  durationMinutes: number;
}): Promise<string> {
  const { data, error } = await requireSupabaseClient().rpc("start_park_checkin", {
    p_place_id: input.placeId,
    p_duration_minutes: input.durationMinutes,
  });
  if (error) throw error;
  void trackProductEvent("park_checkin_started", { duration: input.durationMinutes });
  void requestNotificationDelivery({ type: "park_checkin", checkinId: data }).catch(
    (notificationError) => {
      console.error("Park bildirimi gönderilemedi:", notificationError);
    },
  );
  return data;
}

export async function endMyParkCheckin(): Promise<void> {
  const { error } = await requireSupabaseClient().rpc("end_my_park_checkin");
  if (error) throw error;
  void trackProductEvent("park_checkin_ended");
}

export async function loadParkNotificationsEnabled(): Promise<boolean> {
  const { data, error } = await requireSupabaseClient().rpc("my_park_notifications_enabled");
  if (error) throw error;
  return data ?? true;
}

export async function setParkNotifications(enabled: boolean): Promise<void> {
  const { error } = await requireSupabaseClient().rpc("set_park_notifications", {
    p_enabled: enabled,
  });
  if (error) throw error;
}
