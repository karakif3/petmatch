/**
 * Sohbet listesinin yapısını kuran saf mantık — gün ayraçları ve balon
 * gruplaması. React Native / Expo importu yok; ekran yalnızca sonucu çiziyor.
 *
 * Metin biçimlendirme bilerek DIŞARIDA: "Bugün" / "Dün" ve saat gösterimi
 * dile ve yerel ayara bağlı. Buradan yalnızca ham ISO tarih çıkıyor,
 * etiketlemeyi sunum katmanı yapıyor.
 */

/** Gruplama için gereken minimum mesaj şekli. */
export type GroupableMessage = {
  id: string;
  senderId: string;
  createdAt: string;
};

export type ChatListItem<TMessage extends GroupableMessage> =
  | { kind: "date"; id: string; isoDate: string }
  | { kind: "message"; id: string; message: TMessage; grouped: boolean };

/** Aynı gönderenin bu süre içindeki ardışık mesajları tek blok sayılır. */
export const GROUPING_WINDOW_MS = 5 * 60 * 1000;

/** Yerel takvim günü anahtarı — UTC değil, kullanıcının günü. */
export function localDateKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Mesaj dizisini gün ayraçları serpiştirilmiş liste öğelerine çevirir.
 * Girdi eskiden yeniye sıralı olmalı.
 */
export function buildChatItems<TMessage extends GroupableMessage>(
  messages: TMessage[],
): ChatListItem<TMessage>[] {
  const items: ChatListItem<TMessage>[] = [];
  let previous: TMessage | null = null;

  for (const message of messages) {
    const day = localDateKey(message.createdAt);

    if (!previous || localDateKey(previous.createdAt) !== day) {
      items.push({ kind: "date", id: `date:${day}`, isoDate: message.createdAt });
    }

    // Gün değiştiyse gruplama kırılır: ayracın hemen altındaki balon her
    // zaman tam köşeli görünmeli.
    const grouped =
      previous !== null &&
      previous.senderId === message.senderId &&
      localDateKey(previous.createdAt) === day &&
      new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() <
        GROUPING_WINDOW_MS;

    items.push({ kind: "message", id: message.id, message, grouped });
    previous = message;
  }

  return items;
}
