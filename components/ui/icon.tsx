import {
  Ban,
  Calendar,
  Camera,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CloudOff,
  Ellipsis,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Flag,
  Hand,
  Heart,
  HeartCrack,
  House,
  Image,
  Info,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Mars,
  MessageCircle,
  MessagesSquare,
  PawPrint,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  SquareCheckBig,
  Star,
  Trash2,
  User,
  UserPlus,
  Users,
  Venus,
  X,
  type LucideIcon,
} from "lucide-react-native";
import type { StyleProp, ViewStyle } from "react-native";

/**
 * Uygulamanın tek ikon ailesi: **Lucide**.
 *
 * Neden tek aile: Ionicons **dolu** bir aileden geliyor ve kararın verildiği
 * yüzeylerde "sticker" gibi duruyordu. Lucide çizgi tabanlı, tek `strokeWidth`
 * ekseni olan bir aile; boyut büyüdükçe çizgi orantısız kalınlaşmıyor.
 *
 * Neden `name` prop'lu tek bileşen, 111 yerde doğrudan Lucide importu değil:
 * ikon sözlüğü tek dosyada durunca çizgi kalınlığı, dolgu kuralı ve boyut
 * skalası tek yerden değişebiliyor. Karışık aile (yarı Ionicons yarı Lucide)
 * tam da bu merkez olmadığı için oluşmuştu.
 *
 * **Adlandırma Lucide'ın kendi sözlüğü.** Ionicons adlarını (`paw`,
 * `chevron-forward`, `checkmark-circle`) korumak bir çeviri katmanı demekti;
 * bir ikon eklemek isteyen kişinin Lucide'da arayıp buradaki karşılığını da
 * bulması gerekirdi.
 *
 * **`-outline` yok.** Lucide zaten çizgi; dolgu ayrı bir isim değil,
 * `filled` prop'u. Dolgu YALNIZCA durum anlatan yerlerde kullanılır (sekme
 * çubuğunda seçili sekme, karar şeridinde beğen/süper). Süsleme amaçlı
 * dolgu bilerek yok — Ionicons'tan kaçış sebebi zaten oydu.
 *
 * ⚠️ `filled`, dolgusu iç detayı yutmayan gliflerde çalışır (kalp, yıldız,
 * pati, daire, konuşma balonu). `circle-check` gibi içinde çizgi taşıyan bir
 * glifte dolgu, çeki görünmez yapar — o yüzden oralarda kullanılmıyor.
 */
export const ICONS = {
  ban: Ban,
  calendar: Calendar,
  camera: Camera,
  check: Check,
  "check-check": CheckCheck,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  circle: Circle,
  "circle-alert": CircleAlert,
  "circle-check": CircleCheck,
  "circle-dot": CircleDot,
  "cloud-off": CloudOff,
  "document-text": FileText,
  ellipsis: Ellipsis,
  "external-link": ExternalLink,
  eye: Eye,
  "eye-off": EyeOff,
  flag: Flag,
  hand: Hand,
  heart: Heart,
  "heart-crack": HeartCrack,
  house: House,
  image: Image,
  info: Info,
  lock: Lock,
  "log-out": LogOut,
  mail: Mail,
  "map-pin": MapPin,
  mars: Mars,
  "message-circle": MessageCircle,
  "messages-square": MessagesSquare,
  "paw-print": PawPrint,
  plus: Plus,
  "refresh-cw": RefreshCw,
  reply: Reply,
  search: Search,
  send: Send,
  shield: Shield,
  "shield-check": ShieldCheck,
  "sliders-horizontal": SlidersHorizontal,
  sparkles: Sparkles,
  square: Square,
  "square-check-big": SquareCheckBig,
  star: Star,
  "trash-2": Trash2,
  user: User,
  "user-plus": UserPlus,
  users: Users,
  venus: Venus,
  x: X,
} satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof ICONS;

export type AppIconProps = {
  name: AppIconName;
  /** Boyut skalası: 14/16/18/20/22/24. Kart ve düğme içindeki büyükler ayrı. */
  size?: number;
  color?: string;
  /** Durum anlatan dolgu. Yalnızca kapalı şekilli gliflerde kullan. */
  filled?: boolean;
  strokeWidth?: number;
  /** Hizalama düzeltmeleri için (ör. metin yanında `marginLeft`). */
  style?: StyleProp<ViewStyle>;
  /**
   * İkon TEK BAŞINA anlam taşıyorsa gerekli. Yanında aynı bilgiyi veren bir
   * metin varsa verme — ekran okuyucu aynı şeyi iki kez okur.
   */
  accessibilityLabel?: string;
};

export function AppIcon({
  name,
  size = 20,
  color = "#1F1A17",
  filled = false,
  strokeWidth = 2,
  style,
  accessibilityLabel,
}: AppIconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      fill={filled ? color : "none"}
      style={style}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

/**
 * Karar ikonları — geç / süper beğeni / beğen + uyum rozeti.
 *
 * Ayrı duruyor çünkü çağrı yerleri `AppIcon`'un varsayılanlarını değil
 * kendi boyut/dolgu/kalınlık değerlerini kullanıyor (60-70pt düğme içinde
 * 30pt ikon). Kayıt defteriyle aynı aileden besleniyor.
 */
export const DecisionIcons = {
  pass: X,
  superLike: Star,
  like: Heart,
  compatibility: Sparkles,
} satisfies Record<string, LucideIcon>;

/**
 * Karar düğmelerinin ortak çizgi kalınlığı. Lucide varsayılanı 2; 60-70pt
 * çapındaki düğmelerin içinde 22-24pt bir ikon 2'de cılız kalıyor, 2.5
 * ağırlığı düğmenin kütlesine oturuyor.
 */
export const DECISION_STROKE = 2.5;
