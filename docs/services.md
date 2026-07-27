# Servisler — ne gerekiyor, ne paylaşılabilir

İlke: **mümkün olan en az yeni hesap.** Aşağıdakilerin hiçbiri yeni bir
*hesap* açmayı gerektirmiyor — hepsi mevcut hesapların altına yeni
proje/uygulama kaydı olarak ekleniyor. Tek gerçek engel Supabase'in ücretsiz
plan kotası (aşağıda).

## Bugün gereken

| Servis | Durum | Not |
|---|---|---|
| Node + npm | ✅ var | v26.5.0 |
| Expo CLI | ✅ hesap gerekmez | `npx expo start` giriş istemiyor |
| Supabase | ✅ proje bağlı | Migration ve generated type akışı hazır |
| Expo / EAS | ⏳ giriş gerekli | Push için `eas login` + `eas init`; CLI şu anda oturum açmamış |

## Supabase — tek gerçek kısıt

Ücretsiz plan **sahibi/yöneticisi olduğun tüm organizasyonlar genelinde toplam
2 aktif proje** ile sınırlı. Slipbook ve Tellora bu iki slotu doldurmuş
durumda — yeni organizasyon açmak sınırı aşmıyor, sınır hesap genelinde.

Seçenekler:

| Yol | Maliyet | Not |
|---|---|---|
| **Yerel Supabase** (Docker) | ücretsiz | ✅ Docker bu makinede kurulu ve çalışıyor. `npm run local:start` → bulut projesi hiç açılmadan tüm geliştirme yerelde; `npm run gen:types` de yerel şemadan çalışır. |
| Pro plana geçiş | org başına $25/ay | Aynı org altında ek proje açılır; slipbook/tellora'yı da kapsar |
| Bir projeyi duraklat | ücretsiz | Duraklatılmış proje kotaya sayılmaz — ama canlı ürünü duraklatmak makul değil |

Şema, migration'lar ve tüm domain mantığı bu karardan **bağımsız** —
`supabase db push` hangi projeye bakıyorsa oraya uygulanır.

## Sırası gelince gereken (MVP'de değil)

| Servis | Yeni hesap? | Not |
|---|---|---|
| Apple Developer | ❌ hayır | Mevcut $99/yıl üyelik; yeni Bundle ID (`com.petmatch.app`) |
| Google Play Console | ❌ hayır | Mevcut geliştirici hesabı; yeni uygulama kaydı |
| Expo / EAS | ❌ hayır | Yukarı taşındı: push bildirimleri için artık gerekiyor |
| Google Sign-In | ❌ hayır | Aynı Google Cloud projesi; yeni bundle için yeni OAuth client ID |
| Apple Sign-In | ❌ hayır | Aynı Apple hesabı; yeni App ID üzerinde capability |
| PostHog | ❌ hayır | Mevcut hesap; yeni proje + API key |
| RevenueCat | ❌ hayır | MVP'de premium yok — gerekmiyor |
| Domain | ⚠️ ayrı satın alma | Sadece pazarlama sitesi/web app'i istenirse |

## Gerekmeyen

- **Bunny CDN** — pet fotoğrafları Supabase Storage'da; ayrı CDN gereksiz.
- **Ayrı auth sağlayıcı** — web ve mobil aynı Supabase Auth oturumunu kullanır.

## Başka hesaba taşıma

Repoda hiçbir proje ref'i / hesap kimliği hard-code değil. Taşıma:

```bash
supabase link --project-ref <yeni-ref>
supabase db push
# .env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_PROJECT_ID
npm run gen:types
```

Storage bucket'ları migration `0004_storage.sql` ile birlikte gelir; elle
kurulum gerekmez.
