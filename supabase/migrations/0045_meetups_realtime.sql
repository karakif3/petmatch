-- Buluşma yanıtı canlı düşmüyordu: karşı taraf onayladığında/reddettiğinde
-- kart güncellenmiyor, kullanıcı ekrandan çıkıp girmek zorunda kalıyordu.
-- Mesajlarda zaten realtime var (0015); aynı desen meetups'a da uygulanıyor.

do $$
begin
  alter publication supabase_realtime add table meetups;
exception
  when duplicate_object then null;
end;
$$;
