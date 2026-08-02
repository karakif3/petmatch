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
};

export async function listMeetupPlaces(): Promise<MeetupPlace[]> {
  const { data, error } = await requireSupabaseClient().rpc("list_meetup_places");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    note: row.note,
  }));
}

/**
 * Sohbete gönderilecek buluşma önerisi metni.
 *
 * Halka açık yer vurgusu metnin İÇİNDE: öneriyi güvenlik mesajından ayırmak,
 * kullanıcının o mesajı silip yerine "bize gelsene" yazmasını kolaylaştırır.
 */
export function meetupProposalText(place: MeetupPlace): string {
  const where = place.note ? `${place.name} (${place.note})` : place.name;
  return `${where} nasıl olur? 🐾 İlk buluşma için halka açık bir yer olması ikimiz için de rahat olur. Sana uygun gün ve saat nedir?`;
}
