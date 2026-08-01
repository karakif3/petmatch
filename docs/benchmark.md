# Benchmark — tanışma uygulamalarından ne alınmalı

Tinder, Bumble, Hinge ve pet odaklı Dig'in yerleşik desenleri; her biri
PetMatch'in bugünkü durumuyla karşılaştırıldı.

Seçim ölçütü tek: **PetMatch'in kimliğine uyuyor mu.** Ürünün vaadi "petler
tanıştırır"; bir desen ancak bu vaadi güçlendiriyorsa alınmalı. Jenerik
tanışma mekaniğini taklit etmek, iki turdur kaçındığımız yere götürür.

---

## 1. Hinge'in "We Met" geri besleme döngüsü → **en yüksek getirili**

Hinge eşleşmeden sonra "buluştunuz mu?" diye soruyor ve cevabı öneri
motoruna geri veriyor. Şirket başarıyı uygulamada geçen süreyle değil
**kurulan buluşma sayısıyla** ölçtüğünü söylüyor.

**Neden PetMatch için özellikle değerli:**

Sıralama tasarımını [`monetization.md`](monetization.md) sonunda açık bırakmıştık:
mesafe, son aktiflik, uyum skoru ve boost yarışıyor ama hangisinin işe
yaradığını gösteren bir sinyal yok. "Buluştunuz mu?" o sinyal. Üstelik
park buluşması bu üründe zaten doğal bir olay — sormak zorlama durmuyor.

Yan faydası: gerçekleşen buluşma, doğrulama rozetinden bağımsız bir güven
sinyali üretiyor.

| | |
|---|---|
| Bugün | Yok |
| Maliyet | Küçük tablo + sohbet içi tek soru + sıralamaya girdi |
| Risk | Sorunun zamanlaması; erken sorulursa gürültü |

## 2. "Sıra sende" göstergesi → **ucuz ve ölçülmüş**

Hinge'in 2017'de eklediği yanıt sırası göstergesi, **konuşmaya
dönüşmeden ölen eşleşmeleri %25 azaltmış**. 2024'te "Your Turn Limits" ile
sekiz yanıtsız mesajı olan kullanıcıyı yeni sohbet açmadan önce yanıtlamaya
zorlamayı denemişler.

Bağlam: sohbetlerin yaklaşık %40'ı ikinci-üçüncü mesajdan sonra ölüyor ve
24 saat içinde yanıt alan eşleşmelerin buluşmaya dönüşme olasılığı belirgin
şekilde yüksek.

| | |
|---|---|
| Bugün | Gelen kutusunda okunmamış var ama "sıra kimde" yok |
| Maliyet | `list_my_conversations` zaten son mesajı biliyor; rozet + sıralama |
| Risk | Baskı hissi; nazik dil şart |

## 3. Buluşma yeri önerisi → **Dig'in yaptığı, bize daha çok yakışan**

Dig sohbetin içinde köpek dostu buluşma planlamayı ve mahalledeki parkları
aramayı sunuyor; ayrıca veteriner ve eğitmenlerden ilk buluşma ipuçları
veriyor.

PetMatch'te bu aynı zamanda bir **güvenlik** özelliği: ilk buluşmanın halka
açık bir parkta olmasını önermek, tanımadığı biriyle buluşan kullanıcıyı
koruyor. Hazır mesajlarımız zaten "halka açık bir yer seçelim" diyor —
öneriyi somutlaştırmak doğal devam.

| | |
|---|---|
| Bugün | Hazır mesaj metninde geçiyor, yer önerisi yok |
| Maliyet | Şehir bazlı küratörlü park listesiyle başlanabilir; harita gerekmez |
| Risk | Yer verisi bakımı |

## 4. Buluşma güvenliği: paylaş ve yoklama → **gerçek boşluk**

Tinder'ın Noonlight entegrasyonu buluşma detaylarını paylaşmayı ve panik
butonunu sunuyor. Bumble'ın güvenlik merkezi benzer araçlar taşıyor.

PetMatch'te insanlar **fiziksel olarak buluşuyor** ve bu ürünün amacı. Şu an
buluşma öncesi/sonrası hiçbir güvenlik aracı yok.

En hafif sürüm: buluşma detayını bir arkadaşa paylaşan bir bağlantı +
buluşma saatinden sonra "iyi misin?" yoklaması. Panik butonu ve üçüncü taraf
entegrasyonu gerekmiyor.

| | |
|---|---|
| Bugün | Yok |
| Maliyet | Orta — paylaşma bağlantısı ucuz, yoklama zamanlanmış iş ister |
| Risk | Yanlış güven hissi vermemek; dil dikkatli olmalı |

## 5. Doğrulamayı doğru anda istemek

Sektörde doğrulama artık standart: selfie/video doğrulaması Tinder, Bumble ve
Hinge'de var. Tinder ABD'de yeni kullanıcılara eşleşmeden önce yüz kontrolü
zorunlu tutuyor; Bumble'da isteğe bağlı ve **çoğu kullanıcı atlıyor**.

Ders şu: isteğe bağlı doğrulama, istenme anı kötüyse ölü kalıyor.
[`goal-model.md`](goal-model.md) doğrulamayı kayıt akışından çıkarıp
"profil tamamlandıktan sonra" demişti — Bumble'ın verisi bunun yeterli
olmayabileceğini söylüyor. En iyi an muhtemelen **ilk eşleşmeden hemen
sonra**: değeri o an somut.

| | |
|---|---|
| Bugün | Doğrulama var (sahip+pet selfie, moderasyon kuyruğu), istem zamanı belirsiz |
| Maliyet | Sıfır — sadece istem yerini seçmek |

---

## Bilerek almadıklarımız

| Desen | Neden hayır |
|---|---|
| **Uygulama içi video görüşme** | Ağır. PetMatch'te buluşma zaten halka açık bir parkta ve yanında hayvan var; risk profili flört uygulamasından farklı. Güvenlik bütçesi madde 4'e gitmeli. |
| **Panik butonu / acil servis entegrasyonu** | Üçüncü taraf bağımlılığı ve yasal sorumluluk. Hafif sürümü (paylaş + yoklama) faydanın çoğunu veriyor. |
| **Süreli eşleşme (Bumble 24 saat)** | Yoğunluk yokken zararlı: az sayıda eşleşmeyi zaman aşımıyla yok etmek boş desteyi daha da boşaltır. Yoğunluk oluşunca yeniden bakılabilir. |
| **Kimlik/ID kapısı** | Zaten [`backlog.md`](backlog.md) P0-6'da; mağaza konumlandırmasıyla birlikte karar verilecek. |
| **Günlük beğeni limiti** | [`monetization.md`](monetization.md)'de karar verildi: mekanik yazılır, limit yoğunluk oluşana kadar kapalı. |

## Önerilen sıra

1. **"Buluştunuz mu?"** — hem sıralama sinyali hem başarı metriği; ürünün
   neyi optimize ettiğini nihayet tanımlıyor
2. **"Sıra sende"** — ölçülmüş etki, en düşük maliyet
3. **Doğrulama isteminin yerini değiştirmek** — bedava
4. **Buluşma yeri önerisi**
5. **Buluşma güvenliği (paylaş + yoklama)**

---

**Kaynaklar:** [Creative Review — Hinge ve oyunlaştırma](https://www.creativereview.co.uk/hinge-app-gamification-of-dating/) ·
[Hinge nasıl çalışıyor](https://growthscribe.com/how-does-hinge-work/) ·
[Ghosting ve yanıt oranları](https://www.wingedapp.com/blog/ghosting-dating-app) ·
[Sohbetlerin ilk 10 dakikada ölmesi](https://trustyourmatch.com/why-dating-app-conversations-die/) ·
[Bumble güvenlik özellikleri](https://support.bumble.com/hc/en-us/articles/28537051467293-Our-safety-features) ·
[Tinder güvenlik ve panik butonu](https://boostmatches.com/tinder-safety/) ·
[Doğrulama karşılaştırması 2026](https://millionairedating.onluxy.com/best-dating-apps-safety-verification-2026.html) ·
[Dig — köpek sahiplerinin uygulaması](https://www.goodmorningamerica.com/living/story/love-dogs-dating-app-dig-helps-dog-lovers-71805938) ·
[Modern Dog — köpek severlere uygulamalar](https://moderndogmagazine.com/articles/the-best-dating-websites-apps-for-dog-lovers/)
