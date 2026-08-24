-- 0054 tetikleyici fonksiyonlarını PUBLIC'e açık bırakmıştı (CREATE FUNCTION
-- varsayılanı). İstemci bunları çağırmamalı; tetikleyici tablo sahibi olarak
-- çalışır. Aynı sıkılaştırmayı keşfet yardımcıları için de tekrarlıyoruz.

revoke all on function enforce_owner_photo_reciprocity()
  from public, anon, authenticated;
revoke all on function clear_owner_photo_filter_when_private()
  from public, anon, authenticated;
revoke all on function shares_discover_region(uuid, uuid)
  from public, anon, authenticated;
revoke all on function discover_pets(uuid, text[], integer, integer, integer)
  from public, anon, authenticated;
