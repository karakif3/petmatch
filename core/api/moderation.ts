import { STORAGE_BUCKETS } from "./config";
import { requireSupabaseClient } from "./supabase.client";
import { requestNotificationDelivery } from "./notifications";

export type VerificationRejectionReason =
  | "unclear_photo"
  | "pet_not_visible"
  | "owner_not_visible"
  | "multiple_people"
  | "edited_photo"
  | "other";

export type ModerationQueueItem = {
  id: string;
  kind: "report" | "verification" | "photo";
  status: "pending" | "approved" | "rejected";
  subjectUserId: string | null;
  subjectPetId: string | null;
  reason: string | null;
  note: string | null;
  createdAt: string;
  ageHours: number;
  slaBreached: boolean;
  verificationPhotoUrl: string | null;
  verificationPhotoPath: string | null;
};

export type OperationsMetrics = {
  moderation_pending: number;
  moderation_sla_breached: number;
  notification_failed_24h: number;
  client_errors_24h: number;
  funnel_7d: Record<string, number>;
  notification_failures: {
    event_type: string;
    message: string | null;
    created_at: string;
  }[];
  client_error_samples: {
    name: string;
    message: string;
    route: string | null;
    created_at: string;
  }[];
};

export async function loadModerationOperations(): Promise<{
  items: ModerationQueueItem[];
  metrics: OperationsMetrics;
}> {
  const sb = requireSupabaseClient();
  const [queueResult, metricsResult] = await Promise.all([
    sb.rpc("get_moderation_queue", { p_limit: 50 }),
    sb.rpc("get_operations_metrics"),
  ]);
  if (queueResult.error) throw queueResult.error;
  if (metricsResult.error) throw metricsResult.error;

  const items = await Promise.all(
    (queueResult.data ?? []).map(async (row) => {
      const path =
        row.kind === "verification" &&
        row.payload &&
        typeof row.payload === "object" &&
        !Array.isArray(row.payload) &&
        typeof row.payload.photo_path === "string"
          ? row.payload.photo_path
          : null;
      let verificationPhotoUrl: string | null = null;
      if (path) {
        const { data } = await sb.storage
          .from(STORAGE_BUCKETS.verificationPhotos)
          .createSignedUrl(path, 60 * 10);
        verificationPhotoUrl = data?.signedUrl ?? null;
      }
      return {
        id: row.id,
        kind: row.kind,
        status: row.status,
        subjectUserId: row.subject_user_id,
        subjectPetId: row.subject_pet_id,
        reason: row.reason,
        note: row.note,
        createdAt: row.created_at,
        ageHours: Number(row.age_hours),
        slaBreached: row.sla_breached,
        verificationPhotoUrl,
        verificationPhotoPath: path,
      };
    }),
  );

  return {
    items,
    metrics: metricsResult.data as unknown as OperationsMetrics,
  };
}

export async function reviewModerationItem(input: {
  id: string;
  decision: "approved" | "rejected";
  note: string;
  rejectionReason?: VerificationRejectionReason | null;
  verificationPhotoPath?: string | null;
}): Promise<void> {
  const sb = requireSupabaseClient();
  const { error } = await sb.rpc("review_moderation_item", {
    p_item_id: input.id,
    p_decision: input.decision,
    p_note: input.note || undefined,
    p_rejection_reason_code: input.rejectionReason ?? undefined,
  });
  if (error) throw error;
  if (input.decision === "approved" || input.rejectionReason) {
    void requestNotificationDelivery({
      type: "verification",
      moderationItemId: input.id,
    }).catch((notificationError) => {
      console.warn("Doğrulama sonucu bildirimi gönderilemedi:", notificationError);
    });
  }
  if (input.verificationPhotoPath) {
    const { error: cleanupError } = await sb.storage
      .from(STORAGE_BUCKETS.verificationPhotos)
      .remove([input.verificationPhotoPath]);
    if (cleanupError) {
      console.warn("İncelenen doğrulama fotoğrafı temizlenemedi:", cleanupError.message);
    }
  }
}
