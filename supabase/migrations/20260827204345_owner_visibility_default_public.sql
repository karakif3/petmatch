-- Yeni kayıt: sahip profili keşfette görünür başlar.
--
-- Ürün kararı: gizleme Keşfet'te teşvik edilmez; kullanıcı sonradan
-- Sahip profili ayarından kapatır. Açık rıza onboarding checkbox'ında
-- `public_profile_consent` olarak yazılır (`completeOnboarding`).
--
-- Mevcut satırlar dokunulmaz — after_match/hidden tercihleri korunur.

alter table profiles
  alter column owner_visibility set default 'public';
