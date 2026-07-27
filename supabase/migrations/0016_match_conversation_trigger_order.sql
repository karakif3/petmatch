-- open_match_conversation bir AFTER INSERT trigger'ıdır.
--
-- NOT NULL kısıtı AFTER trigger'dan önce kontrol edildiği için 0015'teki
-- `set not null` yeni match insertlerini engellerdi. Kolon transaction içindeki
-- kısa süre için nullable kalır; trigger aynı transaction'da conversation'ı
-- oluşturup alanı doldurur. Trigger hatası tüm inserti geri alır.

alter table matches alter column conversation_id drop not null;
