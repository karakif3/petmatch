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
} as const;
