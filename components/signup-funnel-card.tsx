import { Text, View } from "react-native";

import type { SignupFunnel } from "../core/api/moderation";
import { funnelConversions } from "../core/domain/funnel";

/**
 * Operasyon merkezindeki kohort hunisi: son N günde kaydolanlar hangi
 * adıma kadar geldi. Yüzde, bir önceki adıma göre — kopuşun NEREDE
 * olduğunu gösteren o.
 */
export function SignupFunnelCard({ funnel }: { funnel: SignupFunnel }) {
  const rows = funnelConversions(funnel.steps);
  const top = rows[0]?.count ?? 0;
  return (
    <>
      <Text className="mb-3 text-lg font-bold text-text-primary">
        Kayıt hunisi · {funnel.days} gün
      </Text>
      <View className="mb-5 rounded-2xl border border-border bg-surface p-4">
        {top === 0 ? (
          <Text className="text-sm text-text-secondary">Bu dönemde yeni kayıt yok.</Text>
        ) : (
          rows.map((row) => (
            <View key={row.key} className="border-b border-border py-2 last:border-b-0">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-text-secondary">{row.label}</Text>
                <Text className="font-bold text-text-primary">
                  {row.count}
                  {row.fromPrevious !== null ? (
                    <Text className="text-xs font-normal text-text-secondary">
                      {"  "}%{row.fromPrevious}
                    </Text>
                  ) : null}
                </Text>
              </View>
              <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                <View
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${Math.round((row.count / top) * 100)}%` }}
                />
              </View>
            </View>
          ))
        )}
      </View>
    </>
  );
}
