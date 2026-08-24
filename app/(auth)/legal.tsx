import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { ScreenHeader } from "../../components/ui/screen-header";
import { getLegalConfig, LEGAL_DOCUMENT_VERSION } from "../../core/domain/legal";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-6 rounded-2xl border border-border bg-surface p-5">
      <Text className="mb-3 text-lg font-bold text-text-primary">{title}</Text>
      <Text className="text-sm leading-6 text-text-secondary">{children}</Text>
    </View>
  );
}

export default function LegalScreen() {
  const config = getLegalConfig();
  const [linkError, setLinkError] = useState<string | null>(null);

  const openDocument = async (url: string) => {
    setLinkError(null);
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error("unsupported-url");
      await Linking.openURL(url);
    } catch {
      setLinkError("Belge şu anda açılamadı. Bağlantını kontrol edip tekrar dene.");
    }
  };

  return (
    <ScrollView className="flex-1 bg-bg-primary" contentContainerClassName="px-5 pb-12 pt-16">
      <ScreenHeader
        title="Yasal ve gizlilik"
        subtitle={`Sürüm ${LEGAL_DOCUMENT_VERSION}`}
        onBack={() => router.back()}
      />

      {!config.readyForRelease ? (
        <View className="mb-5 rounded-xl border border-warning bg-warning/10 p-4">
          <Text className="font-semibold text-text-primary">Yayın yapılandırması eksik</Text>
          <Text className="mt-1 text-xs leading-5 text-text-secondary">
            Veri sorumlusu unvanı, adresi ve başvuru e-postası yayın build’inden önce
            ortam değişkenlerine yazılmalı.
          </Text>
        </View>
      ) : null}

      {config.privacyUrl || config.termsUrl || config.accountDeletionUrl ? (
        <View className="mb-5 rounded-xl border border-border bg-surface p-4">
          <Text className="mb-2 font-bold text-text-primary">Herkese açık belgeler</Text>
          {[
            ["Gizlilik politikası", config.privacyUrl],
            ["Kullanım koşulları", config.termsUrl],
            ["Hesap silme talebi", config.accountDeletionUrl],
          ].map(([label, url]) =>
            url ? (
              <Pressable
                key={label}
                accessibilityRole="link"
                onPress={() => void openDocument(url)}
                className="min-h-11 justify-center"
              >
                <Text className="font-semibold text-brand-dark">{label} ↗</Text>
              </Pressable>
            ) : null,
          )}
        </View>
      ) : null}
      {linkError ? (
        <Text accessibilityRole="alert" className="mb-5 text-sm font-semibold text-danger">
          {linkError}
        </Text>
      ) : null}

      <Section title="Gizlilik politikası">
        PetMatch; hesap yönetimi için e-posta ve kullanıcı kimliğini, yaş sınırını
        doğrulamak için doğum tarihini, eşleşme için pet profili ve tercihlerini,
        yaklaşık mesafe için yuvarlanmış koordinatları, iletişim için mesajları ve
        güvenlik için şikâyet/engelleme kayıtlarını işler. Pet fotoğrafları keşfette
        görünürdür. Sahip fotoğrafı yalnızca seçtiğin görünürlük kuralına göre
        paylaşılır; yeni insanlarla tanışmaya açıklık seçimin de profil ve keşfet
        deneyimini oluşturmak için kullanılır. Doğrulama fotoğrafı herkese açık
        değildir. Veriler hizmetin çalışması, güvenlik, kötüye kullanımın önlenmesi
        ve hata tespiti amaçlarıyla kullanılır; reklam amacıyla satılmaz.
      </Section>

      <Section title="KVKK aydınlatma metni">
        Veri sorumlusu: {config.controllerName}. Adres: {config.controllerAddress}.
        İşlenen veri kategorileri kimlik/iletişim, kullanıcı işlem, konum, görsel,
        cihaz-bildirim ve güvenlik kayıtlarıdır. Veriler; üyelik sözleşmesinin
        kurulması ve yürütülmesi, hukuki yükümlülükler, hakkın tesisi/kullanılması,
        meşru menfaat ve yalnızca gerekli yerde ayrı açık rıza hukuki sebeplerine
        dayanarak otomatik yollarla toplanır. Barındırma, kimlik doğrulama ve
        bildirim hizmeti sağlayıcılarına hizmetin gerektirdiği ölçüde aktarılabilir.
        KVKK’nın 11. maddesindeki hakların için {config.supportEmail} adresine
        başvurabilirsin. Aydınlatma bildirimi, isteğe bağlı açık rızalardan ayrıdır.
      </Section>

      <Section title="Açık rıza ve tercihlerin">
        Yaklaşık konum paylaşmak ve sahip profilini herkese açık yapmak isteğe
        bağlıdır. Bu seçimler onboarding veya profil ekranında ayrı ayrı sunulur.
        Rıza vermemek hesabı açmana engel olmaz; ilgili isteğe bağlı özellik çalışmaz.
        Görünürlük tercihini sonradan değiştirebilir ve konum iznini cihaz
        ayarlarından geri alabilirsin.
      </Section>

      <Section title="Konum ve fotoğraf saklama">
        Cihazın kesin konumu gönderilmeden önce yaklaşık 1 km seviyesinde
        yuvarlanır; keşfette kesin koordinat veya adres gösterilmez. Pet fotoğrafları
        profil açık olduğu sürece saklanır. Sahip ve doğrulama fotoğrafları ayrı,
        erişimi kısıtlı depolarda tutulur. Silinen fotoğraflar aktif depodan
        kaldırılır; altyapı yedeklerinin olağan silinme döngüsü ayrıca uygulanabilir.
      </Section>

      <Section title="Kullanım koşulları">
        PetMatch yalnızca 18 yaş ve üzeri kullanıcılar içindir ve pet buluşmaları
        etrafında oyun arkadaşlığı, dostluk veya romantik bağ kurmaya açık,
        pet-first bir sosyal tanışma deneyimi sağlar. Tanışmaya açıklık belirli bir
        ilişki türünü, karşılık veya buluşma yükümlülüğünü garanti etmez. Yanıltıcı
        profil, taciz, ticari hayvan satışı, yasa dışı içerik, başkasının fotoğrafını
        kullanma ve güvenliği riske atan davranışlar yasaktır. Kullanıcı, paylaştığı
        içeriğin haklarına sahip olduğunu ve yüz yüze buluşmalarda kendi güvenlik
        değerlendirmesini yapacağını kabul eder. Kuralları ihlal eden içerik
        kaldırılabilir; hesap kısıtlanabilir veya kapatılabilir.
      </Section>

      <Section title="Hesap ve veri silme politikası">
        Profil ekranındaki “Hesabımı kalıcı olarak sil” işlemi hesabı, petleri,
        fotoğrafları, eşleşmeleri, mesajları, bildirim tokenlarını ve doğrulama
        dosyalarını siler. İşlem geri alınamaz. Kanunen saklanması zorunlu bir kayıt
        varsa yalnızca gerekli süre ve kapsamda erişimi kısıtlı tutulur. Hesaba
        erişemiyorsan {config.supportEmail} üzerinden silme talebi iletebilirsin.
      </Section>

      <Text className="text-center text-xs leading-5 text-text-tertiary">
        Bu metinler yayın öncesinde veri sorumlusu bilgileri, gerçek altyapı
        sağlayıcıları ve hedef pazarlarla birlikte hukuk danışmanı tarafından
        gözden geçirilmelidir.
      </Text>
    </ScrollView>
  );
}
