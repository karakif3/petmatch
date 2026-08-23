# İki fiziksel cihaz yayın testi

Bu senaryo iki gerçek iOS/Android cihaz ve iki ayrı hesapla çalıştırılır.
Simülatör push tokenı üretmediği için yayın onayı olarak kabul edilmez.

## Hazırlık

- Cihaz A ve B'de aynı release candidate development build kurulu.
- İki hesap da açık pilot bölgelerden birinde ve farklı aktif petlere sahip.
- Bildirim izni iki cihazda açık.
- Test başlangıcında hesaplar arasında aktif eşleşme ve engel yok.

## Akış

| # | Cihaz A | Cihaz B | Kabul kanıtı |
|---|---|---|---|
| 1 | B'nin petini beğenir | Uygulama arka planda | Henüz match push'ı gelmez |
| 2 | Uygulamayı kapatır | A'nın petini beğenir | B'de eşleşme anı, A'da match push'ı |
| 3 | Push'a dokunur | Sohbette bekler | Aynı konuşma açılır |
| 4 | Mesaj yollar | Uygulama arka planda | B'de mesaj push'ı ve doğru konuşma deep link'i |
| 5 | Sohbeti açar, yazmaya başlar | Sohbet açık | Yazıyor ve çevrimiçi sinyali |
| 6 | Mesajı okur | Sohbet açık | Okundu durumu |
| 7 | Park ve saat önerir | Öneriyi kabul eder | İki cihazda kabul edilmiş aynı buluşma kartı |
| 8 | Takvime ekler | - | Yer, saat ve resmi kaynak takvim kaydında |
| 9 | B'yi engeller | Mesaj göndermeyi dener | Kanal iki tarafta kapanır, yeni mesaj reddedilir |
| 10 | Engeli kaldırıp raporlar | - | Moderasyon kuyruğunda tek rapor |
| 11 | Şifre sıfırlama ister | - | E-posta development build'i açar; yeni şifre çalışır |

## Sunucu kanıtı

Test sırasında moderasyon ekranında `Push hatası · 24s` artmamalı. Gerekirse
Supabase SQL Editor'da son teslimatlar kontrol edilir:

```sql
select event_type, status, attempted_at, sent_at, last_error
from notification_deliveries
order by attempted_at desc
limit 30;
```

Engelleme sonrasında konuşmanın kapanması ve rapor kaydı:

```sql
select id, is_active, updated_at
from conversations
order by updated_at desc
limit 5;

select kind, status, created_at
from moderation_items
order by created_at desc
limit 10;
```

## Yayın kararı

Tüm satırlar iki platformdan en az birinde geçmeden RC onaylanmaz. iOS ve
Android push kimlik bilgileri farklı olduğu için mağaza yayını öncesinde her
platformda en az bir match ve mesaj push'ı ayrıca doğrulanır.
