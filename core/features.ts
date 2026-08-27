/**
 * Yayındaki yüzeyleri açıp kapatan bayraklar.
 *
 * Kod silmek yerine bayrak kullanılıyor: sahiplendirme yüzeyi çalışır
 * durumda (DB, RLS, RPC'ler, ekran ve testleri yerinde) ama ürünün ana
 * döngüsü — pet profili, keşfet, eşleşme, sohbet — olgunlaşana kadar
 * kullanıcıya gösterilmiyor. Silinseydi geri getirmek yeniden yazmak
 * olurdu; bayrakla geri getirmek tek satır.
 */
export const FEATURES = {
  /**
   * Sahiplendirme (yuva arayan hayvanlar).
   *
   * `false` iken keşfetteki iki giriş noktası da gizleniyor ve ilan sayısı
   * sorgusu hiç atılmıyor. `/adoption` rotası KALDIRILMIYOR: doğrudan
   * gidilirse çalışır — "gizli özellik" tam olarak bu demek, test etmeye
   * devam edebiliyoruz.
   *
   * Açmadan önce: `docs/goal-model.md`'deki huni girişi kararını ve
   * `docs/backlog.md`'deki sahiplendirme maddelerini gözden geçir.
   */
  adoption: false,

  /**
   * Çoklu pet roster'ı (Petlerim: ikinci pet ekleme, aktif pet değiştirme).
   *
   * `false` iken "Petlerim" giriş noktası profil ekranından kalkıyor ve
   * ikinci pet eklemenin tek yolu (bu ekrandan) kapanıyor. DB tarafı
   * (`0062`: roster tabloları, `create_my_pet`/`set_active_pet` RPC'leri)
   * KALDIRILMIYOR — zararsız, kimseye görünmüyor, `/profile/pets` rotası
   * da silinmedi (doğrudan gidilirse çalışır, test etmeye devam edilebilir).
   *
   * Gerekçe: 0063 (pet kimliğini yerinde düzenleme — tür/cinsiyet/ad
   * değiştirilebiliyor) asıl kullanım durumunu ("hayvanım değişti")
   * roster'a hiç ihtiyaç duymadan çözüyor. Roster'ın kattığı tek ek şey —
   * eski peti ayrı bir kayıt olarak arşivde tutmak — nadir bir senaryo,
   * "tek kişi tek hesap" motto'suyla asıl akış değil. Talep gelirse tek
   * satırla geri açılır.
   */
  petRoster: false,
} as const;
