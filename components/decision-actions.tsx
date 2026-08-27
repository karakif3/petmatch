import { View } from "react-native";

import { useTranslation } from "../core/i18n";
import {
  type DecisionPending,
  swipePendingAction,
} from "../core/ui/decision-pending";
import { DecisionButton } from "./ui/decision-button";

export type { DecisionPending };
export { swipePendingAction };

/**
 * Keşfet alt şeridi ve pet profilindeki karar düğmeleri.
 *
 * İki ekranda ayrı JSX vardı; beğen dolgusu birinde güncellenip
 * diğerinde unutuluyordu. Süper yalnızca Keşfet'te — profilde yok
 * (`onSuperLike` verilmez).
 *
 * Spinner yalnızca bekleyen karara düşer. `busy` her zaman üçlüyü
 * kilitler; aksi halde geç beklerken kalp dönüyordu.
 */
export function DecisionActions({
  onPass,
  onLike,
  onSuperLike,
  busy = false,
  pendingAction = null,
}: {
  onPass: () => void;
  onLike: () => void;
  onSuperLike?: () => void;
  busy?: boolean;
  pendingAction?: DecisionPending | null;
}) {
  const t = useTranslation();

  return (
    <View className="flex-row items-center justify-center gap-6">
      <DecisionButton
        variant="pass"
        accessibilityLabel={t("discovery.pass")}
        disabled={busy}
        loading={pendingAction === "pass"}
        onPress={onPass}
      />
      {onSuperLike ? (
        <DecisionButton
          variant="super"
          accessibilityLabel={t("discovery.superLike")}
          disabled={busy}
          loading={pendingAction === "super"}
          onPress={onSuperLike}
        />
      ) : null}
      <DecisionButton
        variant="like"
        accessibilityLabel={t("discovery.like")}
        disabled={busy}
        loading={pendingAction === "like"}
        onPress={onLike}
      />
    </View>
  );
}
