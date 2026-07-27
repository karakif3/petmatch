# Yasal ve mağaza yayın kontrolü

Uygulama içi metinler ve sürümlü onay kayıtları teknik olarak hazırdır. Bu
dosya hukuki görüş değildir; yayın sahibi gerçek işletme bilgileri ve hedef
pazarlarla birlikte hukuk danışmanı tarafından doğrulanmalıdır.

## Yayından önce doldur

- `EXPO_PUBLIC_LEGAL_CONTROLLER_NAME`
- `EXPO_PUBLIC_LEGAL_CONTROLLER_ADDRESS`
- `EXPO_PUBLIC_SUPPORT_EMAIL`
- Herkese açık gizlilik politikası URL'si
- Herkese açık kullanım koşulları URL'si
- Google Play için harici hesap silme talep URL'si

Uygulama içi hesap silme yolu Profil → Hesabımı kalıcı olarak sil'dir. Edge
Function, auth kaydıyla birlikte profil/pet verilerini ve kullanıcıya ait pet,
sahip ve doğrulama fotoğraflarını kaldırır.

## Mağaza beyanı için veri envanteri

- Hesap: e-posta, Supabase kullanıcı kimliği
- Kişisel bilgiler: opsiyonel ad, zorunlu 18+ doğum tarihi, opsiyonel cinsiyet
- Kullanıcı içeriği: pet/sahip fotoğrafları, bio, mesajlar
- Konum: istemcide yaklaşık 1 km seviyesine yuvarlanmış koordinat
- Uygulama etkinliği: beğeni, eşleşme, engelleme, şikâyet, doğrulama durumu
- Cihaz kimliği: Expo push tokenı
- Tanılama: kişisel içerik içermeyecek hata ve ürün olayları

## Resmi referanslar

- KVKK Aydınlatma Yükümlülüğünün Yerine Getirilmesi Rehberi:
  https://www.kvkk.gov.tr/Icerik/5394/Aydinlatma-Yukumlulugunun-Yerine-Getirilmesi-Rehberi
- Apple uygulama içi hesap silme şartı:
  https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Google Play hesap silme şartı:
  https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play Data safety beyanı:
  https://support.google.com/googleplay/android-developer/answer/10787469
