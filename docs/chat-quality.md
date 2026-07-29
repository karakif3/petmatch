# Sohbet kalite ve retention standardı

## Ürün ilkeleri

- Sohbet hızlı hissettirmeli fakat güvenlik ve gizlilik sinyallerini büyütmemeli.
- “Şu an bu sohbette” yalnız iki katılımcı aynı konuşma kanalındayken görünür.
  Uygulama genelindeki kesin çevrimiçi durum paylaşılmaz.
- Son aktiflik kesin dakika/saat yerine `today`, `this_week`, `this_month`
  kovalarıyla gösterilir. Bu veri baskı kurmak veya sıralamada cezalandırmak için
  kullanılmaz.
- “Yazıyor” olayı saklanmaz; kısa süreli Broadcast mesajıdır. Presence yalnız
  online/offline gibi yavaş değişen durum içindir.
- Mesaj veritabanına yazıldıysa “Gönderildi”, karşı taraf `read_at` oluşturduysa
  “Okundu” denir. Taşıma katmanı onayı olmadan “Teslim edildi” denmez.

## Uygulanan kalite tabanı

1. İlk yüklemede son 50 mesaj, isteğe bağlı eski mesaj yükleme.
2. Tarih grupları, ardışık gönderici balon grupları ve yalnız son giden mesajda
   durum bilgisi.
3. Kullanıcı geçmişi okurken otomatik alta zıplatmayan yeni mesaj rozeti.
4. Gönderme hatasında taslağı koruma ve tek dokunuşla yeniden deneme.
5. 44×44 dokunma hedefleri, erişilebilir etiketler, metin + ikonla durum.
6. Güvenli halka açık buluşmayı teşvik eden, otomatik gönderilmeyen başlangıçlar.
7. RLS kontrollü private Realtime kanalı; yalnız konuşma katılımcıları Presence
   ve Broadcast okuyup yazabilir.

## Retention yol haritası

### P1 — fayda ve güven

- Konuşmayı sessize alma, sessiz saatler ve bildirim önizleme tercihi.
- Aktiflik, “yazıyor” ve okundu sinyalleri için anlaşılır gizlilik tercihi;
  kapatan kullanıcı karşı tarafın aynı sinyalini de görmez.
- Gün/saat/halka açık yer alanlı buluşma önerisi; kabul/ret ve isteğe bağlı
  hatırlatıcı. Adres veya canlı konum varsayılan olarak istenmez.
- Doğrulama sonucu ve buluşma yaklaşırken amaç odaklı bildirim.
- Ölçüm: eşleşme → ilk mesaj, ilk mesaj → 24 saat içinde yanıt, buluşma kartı
  kullanımı, bildirimden sohbete dönüş; serbest mesaj metni analitiğe alınmaz.

### P2 — dayanıklılık ve kontrol

- Offline gönderim kuyruğu, sunucu teslim onayı ve idempotency anahtarı.
- Okunmamış mesaj ayıracı, sohbet arama ve medya erişilebilirlik metni.
- Kullanıcı tercihine bağlı okundu bilgisi.
- Spam hız sınırı ve şüpheli link uyarısı; moderasyon için mesaj içeriğini
  üçüncü taraf analitiğe kopyalamadan.

## İki cihaz kabul testi

1. A ve B sohbeti açınca iki tarafta “Şu an bu sohbette” görünür.
2. A yazmaya başlayınca B’de “Yazıyor…” görünür ve en geç dört saniyede söner.
3. A mesajı gönderince “Gönderildi”, B konuşmayı açınca “Okundu” olur.
4. 50’den fazla mesajda eski mesaj yüklemek mevcut okuma konumunu bozmaz.
5. Ağ kapalıyken metin kaybolmaz; hata ve “Tekrar dene” erişilebilir biçimde görünür.
6. B engellenince konuşma kapanır, private kanal yeniden bağlanamaz ve yeni mesaj yazılamaz.
7. Büyük yazı, VoiceOver/TalkBack ve dar ekranlarda gönderme/güvenlik kontrolleri çalışır.
