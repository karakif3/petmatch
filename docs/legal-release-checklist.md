# Yasal ve mağaza yayın kontrolü

Uygulama içi metinler ve sürümlü onay kayıtları teknik olarak hazırdır. Bu
dosya hukuki görüş değildir; yayın sahibi gerçek işletme bilgileri ve hedef
pazarlarla birlikte hukuk danışmanı tarafından doğrulanmalıdır.

## Yayından önce doldur

- `EXPO_PUBLIC_LEGAL_CONTROLLER_NAME`
- `EXPO_PUBLIC_LEGAL_CONTROLLER_ADDRESS`
- `EXPO_PUBLIC_SUPPORT_EMAIL`
- `EXPO_PUBLIC_PRIVACY_URL`
- `EXPO_PUBLIC_TERMS_URL`
- `EXPO_PUBLIC_ACCOUNT_DELETION_URL`

Uygulama içi hesap silme yolu Profil → Hesabımı kalıcı olarak sil'dir. Edge
Function, auth kaydıyla birlikte profil/pet verilerini ve kullanıcıya ait pet,
sahip ve doğrulama fotoğraflarını kaldırır.

Pet-first sosyal/dating konumlandırması mağazaya açılmadan önce:

- App Store/Play açıklaması, kategori, yaş derecesi, ekran görüntüsü ve review
  notları romantik bağ ihtimalini uygulamayla aynı açıklıkta anlatmalı.
- Google Play'de reşit olmayan erişimini kısıtlama kurulmalı; kolay aşılanabilir
  tek checkbox yerine risk-temelli yaş güvencesi doğrulanmalı.
- UGC koşulları; yasak içeriği, raporlama/engelleme yolunu, moderasyon
  iletişimini ve müdahale standardını yayınlanmış biçimde içermeli.
- `2026-08-22-v3` koşulları mevcut kullanıcılar için oturum kapısında kontrol
  edilir; eksik kabul varsa uygulama yasal yeniden kabul ekranına yönlendirir.
- Bağlantı modu açık ve amaçla sınırlı olmalı. Cinsiyet/yönelim tercihi veya
  bunların çıkarımı eklenirse KVKK özel nitelikli veri ve yurt dışı aktarım
  incelemesi tamamlanmadan yayınlanmamalı.

## Mağaza beyanı için veri envanteri

- Hesap: e-posta, Supabase kullanıcı kimliği
- Kişisel bilgiler: opsiyonel ad, zorunlu 18+ doğum tarihi, opsiyonel cinsiyet
- Sosyal tercih: petiyle birlikte yeni insanlarla tanışmaya açıklık; gelecekte
  bağlantı modu eklenirse ayrı envanter ve saklama süresi
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
- Apple UGC, doğru metadata ve dating farklılaşması:
  https://developer.apple.com/app-store/review/guidelines/
- Google Play UGC:
  https://support.google.com/googleplay/android-developer/answer/9876937
- Google Play incidental dating ve minor protection:
  https://support.google.com/googleplay/android-developer/answer/16838200
- KVKK özel nitelikli kişisel veriler:
  https://www.kvkk.gov.tr/Icerik/8364/Ozel-Nitelikli-Kisisel-Verilerin-Islenme-Sartlari
