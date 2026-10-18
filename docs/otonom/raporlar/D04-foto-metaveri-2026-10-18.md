Taban: `7251890` (origin/main)

# Denetim — güvenlik (fotoğraf metaverisi + URL ömrü) — 2026-10-18 · D04

Kapsam: kuyruk D04 kabul 1–5. Dört yükleme yolu, yedi seçici çağrısı, kova/policy migration'ları, imzalı URL süreleri, silme yolları.
Yöntem: salt okuma (`rg`, `sed -n`, `git log -S`, `gh pr list/view`); `is` detached `origin/main`. Test/SQL koşusu yok (madde gerektirmiyor). Hiçbir şey değiştirilmedi, canlıya ve cihaza bağlanılmadı.
**Takılan:** `node_modules/expo-image-picker/ios` listeleme komutu izin sisteminde reddedildi. Yeniden ifade edilip aşılmadı, kütüphanenin yerel kodu okunmadı. Bu yüzden (2)'nin "dosyada GPS kalıyor mu" sorusu **doğrulanmalı (cihaz gerekir)**. Cihazda nasıl ölçüleceği §6'da.
Zaten raporlanmış (tekrar edilmez): kod denetimi §2 "Diğer" — "pet fotoğrafı public bucket, eski URL'ler sonsuza kadar çalışır, EXIF-GPS temizliği doğrulanmamış" (`oc/orchestrator/audit/2026-10-03-kod-denetimi.md:37`). Engellenen tarafın sahip avatar yolunu RPC'den okuması: G03 B1, PR #9.

## 1. Yükleme yolu tablosu

| # | Yol (dosya:satır) | Kova | Kova erişimi | Seçiciden gelen dosya nasıl yükleniyor | Yeniden kodlama / metaveri temizliği |
|---|---|---|---|---|---|
| Y1 | Onboarding pet foto: `core/api/onboarding.ts:133-140`, yol `:131` `<uid>/<petId>/<pos>.<ext>`, `upsert: true` | `pet-photos` | **public** (`0004_storage.sql:11`). Public URL RLS'e uğramaz (`20260929120000:20-24`), anon dahil herkes okur | `fetch(photo.uri)` → `arrayBuffer()` → olduğu gibi `upload` | **yok** |
| Y2 | Profil pet foto: `core/api/profile.ts:571-577` (`savePetPhotos`), yol `:570`. `app/profile/pets.tsx:26-39` yeni pet de buradan geçer | `pet-photos` | **public** (aynı) | ham `arrayBuffer` | **yok** |
| Y3 | Sahip foto/avatar: `core/api/profile.ts:331-337` (`saveOwnerPhotos`) | `owner-avatars` | private (`0004:12`). Okuma `owner_avatars_read_visible` (`0039:40-57`) + imzalı URL | ham `arrayBuffer` | **yok** |
| Y4 | Doğrulama foto: `core/api/profile.ts:425-431` (`submitOwnerVerification`) | `verification-photos` | private (`0021:67-69`). Yalnız sahibi (`0021:78-83`) + moderatör imzalı URL ile (`core/api/moderation.ts:71-73`, 10 dk) | ham `arrayBuffer` | **yok** |

- `package.json:40-41`: yalnız `expo-image` ve `expo-image-picker` var. `expo-image-manipulator` ne `package.json`'da ne `package-lock.json`'da (`rg` boş). `git log -S exif -- app core` boş: koda hiç metaveri işlemi girmemiş.
- `contentType: photo.mimeType ?? "image/jpeg"` (`onboarding.ts:138`, `profile.ts:335,429,575`). Uzantı `fileExtension` (`onboarding.ts:47-53`, `profile.ts:541-547`) dosya adından geliyor. Kova MIME listesinde HEIC/HEIF de var (`20260929120000:38-48`, `0032:5-15`). Sunucuda yeniden kodlama yok. Boyut sınırı pet/sahip için 12 MB (`20260929120000:30-34`, yorumu da "istemci yeniden boyutlandırmıyor" diyor), doğrulama için 6 MB (`0032:7`).

## 2. Seçici seçenekleri

| Çağrı | API | `quality` | `preferredAssetRepresentationMode` | `exif` | Hedef yol |
|---|---|---|---|---|---|
| `app/onboarding.tsx:342-349` | galeri, çoklu | 0.85 | Compatible | verilmemiş | Y1 |
| `app/profile/pet.tsx:315-322` | galeri, çoklu | 0.85 | Compatible | verilmemiş | Y2 |
| `app/profile/pet.tsx:342-347` | kamera | 0.85 | Compatible | verilmemiş | Y2 |
| `app/profile/pets.tsx:84-89` | galeri, çoklu | 0.85 | **verilmemiş** (tek fark) | verilmemiş | Y2 |
| `app/profile/owner.tsx:225-232` | galeri, çoklu | 0.85 | Compatible | verilmemiş | Y3 |
| `app/profile/owner.tsx:250-255` | kamera | 0.85 | Compatible | verilmemiş | Y3 |
| `app/profile/owner.tsx:292-297` | kamera | 0.72 | Compatible | verilmemiş | Y4 |

Çıktı dosyasında EXIF/GPS kalıyor mu: **doğrulanmalı (cihaz gerekir)**. Kütüphane kaynağı okunamadı. Aşağıdakiler kesin değil, cihaz testinde sınanacak hipotezler:
- iOS galeri (PHPicker): `quality < 1` olduğu için kütüphane görüntüyü yeniden JPEG'e kodlayabilir. Bu durumda GPS düşer. Kütüphane sürümü metaveriyi geri yazıyorsa GPS kalır. `pets.tsx:84`'te Compatible modu verilmediği için HEIC orijinal de dönebilir.
- iOS kamera (UIImagePickerController): çekilen kareye genelde konum yazılmaz. Düşük risk.
- Android galeri: `app.json:29-41`'de `ACCESS_MEDIA_LOCATION` yok. Android 10+ bu izin olmadan GPS'i karartıyor olabilir.
- Android kamera: dosyayı sistem kamera uygulaması yazar. Kameranın "konum etiketi" açıksa GPS'in dosyada kalması **en olası sızıntı yolu**dur.
- `exif` seçeneği verilmemiş (varsayılan false). Bu seçeneğin yalnız dönen JS nesnesindeki `asset.exif` alanını mı etkilediği, yoksa dosyayı da temizleyip temizlemediği okunamadı (§5-B).

## 3. Etki — GPS korunuyorsa

| # | Önem | Bulgu | Yer | Senaryo |
|---|---|---|---|---|
| B1 | **Yüksek (koşullu: cihaz testi GPS gösterirse)** | Pet fotoğrafındaki GPS, konum yuvarlamasını tamamen boşa çıkarır | yükleme `profile.ts:574`, `onboarding.ts:137` · kova public `0004:11` · keşif RPC'si yolları eşleşmemiş kullanıcıya döner `0068_owner_age_gender_one_way.sql:263-269` (grant `authenticated` `:314-315`) · istemci public URL kurar `core/api/discovery.ts:91-92,144` · yuvarlama `0007_location_privacy.sql:18-38` | A, evde Android kamerayla çektiği pet fotoğrafını yükler. B, A ile eşleşmemiştir; keşif destesinde A'nın kartını görür. Kartın fotoğraf URL'si public ve imzasızdır. B dosyayı indirip `exiftool` ile açar ve evin metre hassasiyetli koordinatını okur. Sunucu konumu ~1 km ızgaraya yuvarlıyor ve mesafeyi kova olarak dönüyor (`0007:1-13`), ama fotoğraf bu korumanın etrafından dolaşır. URL girişsiz de çalışır (anon, `20260929120000:20-24`). Paylaşılırsa üçüncü kişiler de okur. |
| B2 | Orta (koşullu) | Sahip fotoğrafında aynı sızıntı | `profile.ts:334` · `owner_avatars_read_visible` `0039:40-57` · imza `discovery.ts:173,202,344` | Sahip görünürlüğü `public` olan (varsayılan, A18) kullanıcının fotoğrafı, keşifteki her kullanıcıya 30 dk'lık imzalı URL ile gider. İmzalı URL süresince dosya indirilir, GPS okunur. Kova private olduğu için anon erişemez, ama kitle B1 ile aynı. |
| B3 | Düşük (koşullu) | Doğrulama fotoğrafının GPS'i moderatöre açık | `profile.ts:428` · `moderation.ts:71-73` | Yalnız moderatör görür (10 dk). Moderasyon iç ekip; risk veri minimizasyonu (KVKK) düzeyinde. Backlog'da "metadata temizliği" yalnız bu yol için açık (`docs/backlog.md:662`), oysa asıl risk B1. |

## 4. URL ömrü

| # | Önem | Bulgu | Yer | Senaryo / not |
|---|---|---|---|---|
| U1 | Düşük | Sahip fotoğrafı imzalı URL'leri, engel/eşleşme bitişi/gizlemeden sonra da süre dolana kadar açık kalır | 30 dk: `discovery.ts:173,202,262,344`, `conversations.ts:211` · 60 dk: `profile.ts:234` (kendi profilim), `profile.ts:384` (`loadOwnerPhotos`; başkasının galerisi `app/pet/[petId].tsx:155`) · policy yalnız imza anında bakılır `0039:40-57` | A, B'yi engeller ya da görünürlüğü `hidden` yapar. B'nin elindeki URL 30 dk (galeri ekranında 60 dk) çalışmaya devam eder. Yeni imza isteği policy'ye takılır, yani sızıntı süreyle sınırlı. Galeri imzası (`:384`) keşif imzasının iki katı. Tutarlılık için 30 dk'ya indirilebilir. |
| U2 | Bilgi (zaten raporlu) | Public pet fotoğrafının süresi yok; engel/eşleşme bitişi URL'yi düşürmez | `0004:3-5`, `20260729212719:11-15` (tasarım kararı) · kod denetimi §2 | Tekrar raporlanmadı. Ek gözlem: URL ancak nesne silinince ölür. Silme yolları: yeniden düzenleme `profile.ts:595-601`, geri alma `profile.ts:588-591`, onboarding `onboarding.ts:150-158`, hesap silme `supabase/functions/delete-account/index.ts:84-107` (DB satırları + `listAll` önek taraması, 100'lük partiler). |
| U3 | Düşük — doğrulanmalı | Silinen ya da üzerine yazılan public nesne CDN önbelleğinden bir süre daha servis edilebilir | `upload` çağrılarında `cacheControl` verilmemiş (`profile.ts:574-577`, `onboarding.ts:137-140`) · onboarding sabit yola `upsert: true` yazıyor (`onboarding.ts:131,139`) | Varsayılan önbellek süresi okunmadı (L0/canlı). Hesap silindikten sonra fotoğraf bu süre boyunca URL'den gelebilir. Onboarding'de fotoğraf değiştirildiğinde eski içerik aynı URL'de görünebilir. |

## 5. Düzeltme seçenekleri (uygulanmadı)

| Seçenek | Artı | Eksi / bağ |
|---|---|---|
| **A. İstemcide yeniden kodlama** (`expo-image-manipulator`; tek yardımcı, ör. `core/media/prepare-upload.ts`, dört yol da çağırır) | Seçici davranışından bağımsız: yeniden kodlanan JPEG metaverisiz yazılır (cihazda doğrulanmalı). Yeniden boyutlandırma ile 12 MB/6 MB sınır sorunu ve HEIC dağınıklığı da çözülür. Dört yol tek noktadan geçer. | `package.json` bağımlılığı + yerel modül → yeni dev-client/mağaza derlemesi (L0, sahip). `contentType` (`profile.ts:335,429,575`, `onboarding.ts:138`) ve `fileExtension` (`profile.ts:541`, `onboarding.ts:47`) `image/jpeg`/`jpg`'ye sabitlenmeli. Yönlendirme (EXIF Orientation) piksele işlenmeli. Eski nesneler etkilenmez. `profile.ts` T03 adayıyla aynı dosya. |
| **B. Seçicide `exif: false`** | Sıfır bağımlılık, tek satır | Zaten varsayılan. Büyük olasılıkla yalnız dönen nesneyi etkiler, dosyayı değil (doğrulanmalı). Tek başına çözüm sayılmamalı. |
| **C. Sunucuda temizleme** (edge fonksiyonu / depolama tetikleyicisi, 2. faz) | Eski istemci sürümlerini ve eski nesneleri de kapsar | `pet-photos` public olduğu için ham dosya temizlenene kadar açıkta kalır. Önce private karantina kovasına yükleme gerekir: şema + fonksiyon + istemci değişikliği (L0/L3). Deno'da görüntü işleme maliyeti var. Edge-test hattı 2. fazda. |

Öneri: A (kesin ve ucuz) + cihaz testiyle doğrulama. GPS bulunursa eski nesneler için ayrı tek seferlik işlem (C'nin basit hali, sahip/L0).

## Bulgular → iş önerileri

| # | Önem | Öneri (hat, seviye) | Kabul kriteri |
|---|---|---|---|
| B1-B3 | Yüksek (koşullu) | **Sahip / L0**: cihaz testi (§6) → sonuç tablosu bu rapora/kuyruğa | 7 seçici çağrısı × iOS/Android için "GPS var/yok" tablosu |
| B1-B3 | Yüksek (koşullu) | `app-kucuk-is` (2. faz), sahip D04-K1=A sonrası: `core/media/prepare-upload.ts` yeniden kodlama + dört yükleme yolunun bağlanması | (1) `vi.mock("expo-image-manipulator")` ile birim test: dört yol yardımcıyı çağırır, `contentType` `image/jpeg`, uzantı `jpg`. (2) Cihazda GPS'li fotoğraf yüklenince indirilen dosyada `exiftool -gps:all` boş. (3) `npm test`/`typecheck`/`lint` yeşil. |
| U1 | Düşük | `app-kucuk-is` (2. faz): `profile.ts:384` imza süresi 60 dk → 30 dk (keşifle aynı) | Mevcut testler yeşil; `loadOwnerPhotos` imza süresi testte 1800 olarak kilitli |
| U3 | Düşük | `denetim`: Storage varsayılan önbellek süresi ve silme sonrası public URL davranışı (doküman okuması; canlı sorgu yok) | Rapor: varsayılan `cacheControl` kaynağıyla, silme sonrası beklenen süre |
| B3 | Bilgi | backlog `:662` maddesinin kapsamı pet/sahip fotoğrafına genişletilmeli (doküman işi, `denetim`/tech-lead) | backlog satırı B1'i de anıyor |

## Doğrulanamayanlar / doğrulanmalı

- **(2) Çıktı dosyasında EXIF/GPS** — doğrulanmalı (cihaz gerekir). `node_modules/expo-image-picker/ios` okuması izin sisteminde reddedildi, aşılmadı.
- **§5-B `exif:false`'ın dosyaya etkisi** — doğrulanmalı (kütüphane kaynağı ya da cihaz).
- **Android `ACCESS_MEDIA_LOCATION` yokken galeriden gelen dosyada GPS karartılıyor mu** — doğrulanmalı (cihaz). Kütüphane eklentisinin bu izni manifeste ekleyip eklemediği de okunamadı.
- **U3 CDN önbellek süresi** — doğrulanmalı (Storage dokümanı ya da canlı; canlı L0).
- **Canlıdaki mevcut nesnelerde GPS oranı** — ölçülmedi (canlı veri sorgusu yasak). Sahip isterse aşağıdaki tarifle örnek alır.

## 6. Cihaz tarifi (sahip, L0)

1. iOS ve Android'de telefonun kendi kamerasıyla, konum etiketi açıkken bir fotoğraf çek. Telefonun galerisinde "konum" bilgisinin göründüğünü kontrol et.
2. QA hesabıyla (`<qa-hesabı>`) yedi yolu sırayla dene: onboarding galeri · profil › pet › galeri · profil › pet › kamera · petlerim › yeni pet galeri · profil › sahip › galeri · profil › sahip › kamera · doğrulama kamerası.
3. Supabase panelinde Storage'dan ilgili nesneyi indir (`pet-photos` için kartın public URL'si de olur).
4. `exiftool -gps:all -a <dosya>` ya da macOS Önizleme › Araçlar › Denetçi › GPS. Boş = temiz.
5. Sonucu "yol × platform × GPS var/yok" tablosu olarak kuyruğa yaz. Test nesnelerini sil.

## İyi olanlar

- Yükleme yolları yalnız `<uid>/…` öneki ile yazılabiliyor (`0004:18-48`, `0021:71-76`). `pet-photos` listeleme kapalı (`20260929120000:27`).
- Hesap silme dört kovayı DB satırı + önek taramasıyla temizliyor (`delete-account/index.ts:84-107`).
- Sahip fotoğrafı private + imzalı ve policy engeli/görünürlüğü imza anında uyguluyor (`0039:40-57`). Sızıntı süreyle sınırlı.

## Sahip kararları

kontrol: ✓ — `expo-image-manipulator` `package.json`/`package-lock.json`'da yok ve onu ekleyen açık PR yok (`gh pr list`: #16, #9, #7). `supabase/functions/` mevcut (C uygulanabilir ama 2. faz). Seçenekler birbirinden farklı. Önceki kararlarla (D01–D03, G02 ürün yönü) çelişki yok.

- D04-K1: Fotoğraflardaki konum bilgisi nasıl temizlensin? · seçenekler: A=Uygulamada temizle | B=Önce cihazda test et | C=Sunucuda temizle · A → yeni kütüphane + yeni derleme; hep temiz · B → sen test edersin, sonra yeniden seçilir · C → büyük iş, 2. faz; eskileri de kapsar · öneri: A — neden: test sonucundan bağımsız kesin, boyutu da küçültür
- D04-K2: Engellenen kişi sahip fotoğrafını 30-60 dk daha görebiliyor; kabul mü? · seçenekler: ok|hayir · ok → mevcut süreler kalır · hayir → süre 5 dk'ya iner, daha çok istek · öneri: ok — neden: süre sınırlı, yeni istekler zaten engelleniyor
- D04-K3: Konum çıkarsa önceden yüklenmiş fotoğraflar da temizlensin mi? · seçenekler: ok|hayir · ok → canlıda tek seferlik toplu işlem (sen) · hayir → yalnız yeni yüklemeler temiz olur · öneri: ok — neden: eski fotoğraflar ev konumunu açık tutar
