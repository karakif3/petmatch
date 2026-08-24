import { Pressable, type GestureResponderEvent, type PressableProps } from "react-native";

type Props = PressableProps & {
  className?: string;
  /** Basılı durumda opaklık/ölçek geri bildirimini kapatmak için. */
  disablePressFeedback?: boolean;
};

const pressedStyle = { opacity: 0.92, transform: [{ scale: 0.98 }] } as const;

/**
 * Basılı durumu GERÇEK olan `Pressable` sarmalayıcısı.
 *
 * Öncesi: ~150 `Pressable`'ın hiçbirinde dokunma geri bildirimi yoktu —
 * yalnızca `disabled:opacity-50` vardı, başarılı bir dokunuş sessizdi. Bu
 * en çok kalite algısını düşüren tek şeydi çünkü her ekranı aynı anda
 * etkiliyordu.
 *
 * Bilerek ANİMASYONSUZ (reanimated değil): tek kare içinde değişen bir
 * stil, "hareket" değil "durum bildirimi" sayılır — reduce-motion
 * kullanıcıları için ayrıca kontrol gerekmiyor, `AccessibilityInfo`'ya
 * bağımlı değil.
 *
 * `className` doğrudan içteki gerçek `Pressable`'a iletiliyor; NativeWind
 * yalnızca bilinen react-native ilkellerini (bu dosyadaki gibi doğrudan
 * `<Pressable>` JSX'ini) derleme zamanında dönüştürüyor, bu yüzden sarmalayıcı
 * bileşenler className'i KENDİ render ettikleri gerçek ilkele iletmek
 * zorunda — aksi halde className sessizce hiçbir şey yapmayan bir prop olarak
 * kalır.
 */
export function AppPressable({ style, disabled, disablePressFeedback, ...props }: Props) {
  return (
    <Pressable
      disabled={disabled}
      style={(state) => {
        const base = typeof style === "function" ? style(state) : style;
        if (!state.pressed || disabled || disablePressFeedback) return base;
        return [base, pressedStyle];
      }}
      {...props}
    />
  );
}

export type { GestureResponderEvent };
