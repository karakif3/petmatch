/**
 * Buluşma yerleri.
 *
 * Dig'in sohbet içi buluşma planlamasının karşılığı, ama bizde aynı zamanda
 * bir güvenlik özelliği: ilk buluşmanın halka açık bir parkta olmasını
 * önermek, tanımadığı biriyle buluşan kullanıcıyı koruyor.
 *
 * Sunucu YALNIZCA doğrulanmış yerleri veriyor. Liste boş dönebilir ve bu
 * normaldir — saha teyidi yapılmamış bir bölgede öneri göstermemek,
 * kullanıcıyı hayvan girişine kapalı bir parka yollamaktan iyidir.
 */
import { requireSupabaseClient } from "./supabase.client";

export type MeetupPlace = {
  id: string;
  name: string;
  note: string | null;
  verificationMethod: "official_source" | "field" | null;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceCheckedAt: string | null;
  amenities: string[];
};

export async function listMeetupPlaces(): Promise<MeetupPlace[]> {
  const { data, error } = await requireSupabaseClient().rpc("list_meetup_places");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    note: row.note,
    verificationMethod: row.verification_method as MeetupPlace["verificationMethod"],
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    sourceCheckedAt: row.source_checked_at,
    amenities: row.amenities ?? [],
  }));
}
