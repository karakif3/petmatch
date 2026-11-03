import { useState } from "react";
import { Text, View } from "react-native";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listRegions,
  loadRegionOpeningRecipients,
  notifyRegionOpened,
} from "../core/api/regions";
import { errorMessage } from "../core/domain/error-message";
import { Button } from "./ui/button";

/**
 * Operasyon merkezi: "Bölgem açıldığında haber ver" diyenlere push.
 *
 * Bölge pilot'a migration'la çekildikten sonra moderatör burada bekleyen
 * sayısını görür ve tek düğmeyle gönderir. Tekilleştirme sunucuda
 * (bölge başına kullanıcıya bir kez), yani tekrar basmak güvenli: yalnız
 * yeni gelen talepler gider.
 */
export function RegionOpeningPanel() {
  const queryClient = useQueryClient();
  const regions = useQuery({ queryKey: ["regions"], queryFn: listRegions });
  const pilotRegions = (regions.data ?? []).filter((region) => region.isPilot);
  const recipients = useQueries({
    queries: pilotRegions.map((region) => ({
      queryKey: ["region-opening-recipients", region.slug],
      queryFn: () => loadRegionOpeningRecipients(region.slug),
    })),
  });
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (slug: string, name: string) => {
    setBusySlug(slug);
    setError(null);
    setNotice(null);
    try {
      const result = await notifyRegionOpened(slug);
      setNotice(
        `${name}: ${result.sent} gönderildi · ${result.skipped} cihazsız/kapalı · ${result.duplicate} zaten bildirilmiş.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["region-opening-recipients", slug] });
    } catch (sendError) {
      setError(errorMessage(sendError, "Bildirim gönderilemedi."));
    } finally {
      setBusySlug(null);
    }
  };

  if (!pilotRegions.length) return null;

  return (
    <>
      <Text className="mb-3 text-lg font-bold text-text-primary">Bölge açılışı</Text>
      <View className="mb-5 rounded-2xl border border-border bg-surface p-4">
        {pilotRegions.map((region, index) => {
          const query = recipients[index];
          const rows = query?.data ?? [];
          const pending = rows.filter((row) => !row.alreadyNotified).length;
          const notified = rows.length - pending;
          return (
            <View
              key={region.slug}
              className={`flex-row items-center py-3 ${index > 0 ? "border-t border-border" : ""}`}
            >
              <View className="flex-1 pr-3">
                <Text className="font-bold text-text-primary">{region.name}</Text>
                <Text className="mt-0.5 text-xs text-text-secondary">
                  {query?.isLoading
                    ? "Bekleyenler sayılıyor…"
                    : query?.isError
                      ? "Liste alınamadı"
                      : `Haber bekleyen ${pending} · bildirilmiş ${notified}`}
                </Text>
              </View>
              <Button
                label={pending ? `Haber ver (${pending})` : "Bekleyen yok"}
                variant="secondary"
                onPress={() => void send(region.slug, region.name)}
                loading={busySlug === region.slug}
                disabled={!pending || Boolean(busySlug)}
              />
            </View>
          );
        })}
        {notice ? (
          <Text className="mt-2 text-xs font-semibold text-text-secondary">{notice}</Text>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" className="mt-2 text-xs font-semibold text-danger">
            {error}
          </Text>
        ) : null}
      </View>
    </>
  );
}
