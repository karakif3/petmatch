import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EventBody =
  | { type: "match"; matchId: string }
  | { type: "message"; messageId: string }
  | { type: "new_candidate"; petId: string }
  | { type: "super_like"; swipeId: string };

type PushContent = {
  title: string;
  body: string;
  data: Record<string, string>;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function eventBody(value: unknown): EventBody | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (body.type === "match" && isUuid(body.matchId)) {
    return { type: "match", matchId: body.matchId };
  }
  if (body.type === "message" && isUuid(body.messageId)) {
    return { type: "message", messageId: body.messageId };
  }
  if (body.type === "new_candidate" && isUuid(body.petId)) {
    return { type: "new_candidate", petId: body.petId };
  }
  if (body.type === "super_like" && isUuid(body.swipeId)) {
    return { type: "super_like", swipeId: body.swipeId };
  }
  return null;
}

function haversineKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function petAgeYears(birthDate: string | null): number | null {
  if (!birthDate) return null;
  return (Date.now() - new Date(`${birthDate}T00:00:00Z`).getTime()) /
    (365.25 * 24 * 60 * 60 * 1000);
}

async function claimAndSend(
  admin: ReturnType<typeof createClient>,
  input: {
    eventType: EventBody["type"];
    eventId: string;
    recipientId: string;
    content: PushContent;
  },
): Promise<"sent" | "skipped" | "duplicate"> {
  // super_like'ın kendi tercihi yok; "yeni eşleşme" ile aynı ilgi
  // kategorisine giriyor (biri seninle ilgileniyor), ayrı bir ayar
  // eklemek bu görevin kapsamı dışında.
  const preferenceColumn =
    input.eventType === "match" || input.eventType === "super_like"
      ? "notify_on_match"
      : input.eventType === "message"
        ? "notify_on_message"
        : "notify_on_new_candidates";
  const { data: preferences, error: preferenceError } = await admin
    .from("discovery_preferences")
    .select("notify_on_match,notify_on_message,notify_on_new_candidates")
    .eq("user_id", input.recipientId)
    .single();
  if (preferenceError) throw preferenceError;

  const enabled = Boolean(
    (preferences as Record<string, unknown>)[preferenceColumn],
  );
  const { data: tokens, error: tokenError } = await admin
    .from("push_tokens")
    .select("token")
    .eq("user_id", input.recipientId);
  if (tokenError) throw tokenError;

  const shouldSkip = !enabled || !tokens?.length;
  const { error: claimError } = await admin.from("notification_deliveries").insert({
    event_type: input.eventType,
    event_id: input.eventId,
    recipient_id: input.recipientId,
    status: shouldSkip ? "skipped" : "processing",
  });
  if (claimError?.code === "23505") return "duplicate";
  if (claimError) throw claimError;
  if (shouldSkip) return "skipped";

  try {
    const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(expoAccessToken
          ? { Authorization: `Bearer ${expoAccessToken}` }
          : {}),
      },
      body: JSON.stringify(
        tokens.map(({ token }) => ({
          to: token,
          sound: "default",
          channelId: "petmatch",
          title: input.content.title,
          body: input.content.body,
          data: input.content.data,
        })),
      ),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        typeof payload?.errors?.[0]?.message === "string"
          ? payload.errors[0].message
          : `Expo Push API ${response.status}`,
      );
    }

    const tickets = Array.isArray(payload?.data) ? payload.data : [];
    const invalidTokens = tickets
      .map((ticket: Record<string, unknown>, index: number) =>
        (ticket.details as Record<string, unknown> | undefined)?.error ===
        "DeviceNotRegistered"
          ? tokens[index]?.token
          : null,
      )
      .filter((token: string | null): token is string => Boolean(token));
    if (invalidTokens.length) {
      await admin.from("push_tokens").delete().in("token", invalidTokens);
    }
    const ticketErrors = tickets.filter(
      (ticket: Record<string, unknown>) => ticket.status === "error",
    );
    if (ticketErrors.length) {
      const firstError = ticketErrors[0] as Record<string, unknown>;
      const details = firstError.details as Record<string, unknown> | undefined;
      throw new Error(
        typeof firstError.message === "string"
          ? firstError.message
          : typeof details?.error === "string"
            ? details.error
            : "Expo push ticket error",
      );
    }

    const firstTicketId =
      tickets.find((ticket: Record<string, unknown>) => typeof ticket.id === "string")
        ?.id ?? null;
    await admin
      .from("notification_deliveries")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        ticket_id: firstTicketId,
      })
      .eq("event_type", input.eventType)
      .eq("event_id", input.eventId)
      .eq("recipient_id", input.recipientId);
    return "sent";
  } catch (error) {
    await admin
      .from("notification_deliveries")
      .update({
        status: "failed",
        last_error:
          (error instanceof Error ? error.message : "Push delivery failed").slice(
            0,
            1000,
          ),
      })
      .eq("event_type", input.eventType)
      .eq("event_id", input.eventId)
      .eq("recipient_id", input.recipientId);
    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server is not configured" }, 500);
  }
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Authentication required" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const jwt = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

  const body = eventBody(await request.json().catch(() => null));
  if (!body) return json({ error: "Invalid notification event" }, 400);

  try {
    if (body.type === "match") {
      const { data: match, error: matchError } = await admin
        .from("matches")
        .select("id,pet_a_id,pet_b_id,conversation_id,is_active")
        .eq("id", body.matchId)
        .single();
      if (matchError || !match?.is_active) return json({ error: "Match not found" }, 404);

      const { data: pets, error: petsError } = await admin
        .from("pets")
        .select("id,owner_id,name")
        .in("id", [match.pet_a_id, match.pet_b_id]);
      if (petsError) throw petsError;

      const callerPet = pets?.find((pet) => pet.owner_id === authData.user.id);
      const recipientPet = pets?.find((pet) => pet.owner_id !== authData.user.id);
      if (!callerPet || !recipientPet) return json({ error: "Not a match participant" }, 403);

      const result = await claimAndSend(admin, {
        eventType: "match",
        eventId: match.id,
        recipientId: recipientPet.owner_id,
        content: {
          title: "Yeni eşleşme! 🎉",
          body: `${callerPet.name} ve ${recipientPet.name} eşleşti.`,
          data: {
            type: "match",
            conversationId: match.conversation_id,
          },
        },
      });
      return json({ status: result });
    }

    if (body.type === "super_like") {
      const { data: swipe, error: swipeError } = await admin
        .from("swipes")
        .select("id,from_pet_id,to_pet_id,actor_id,direction,is_super")
        .eq("id", body.swipeId)
        .single();
      if (
        swipeError ||
        !swipe ||
        !swipe.is_super ||
        swipe.direction !== "like" ||
        swipe.actor_id !== authData.user.id
      ) {
        return json({ error: "Super like not found" }, 404);
      }

      const { data: pets, error: petsError } = await admin
        .from("pets")
        .select("id,owner_id,name")
        .in("id", [swipe.from_pet_id, swipe.to_pet_id]);
      if (petsError) throw petsError;

      const fromPet = pets?.find((pet) => pet.id === swipe.from_pet_id);
      const toPet = pets?.find((pet) => pet.id === swipe.to_pet_id);
      if (!fromPet || !toPet) return json({ error: "Pet not found" }, 404);

      const result = await claimAndSend(admin, {
        eventType: "super_like",
        eventId: swipe.id,
        recipientId: toPet.owner_id,
        content: {
          title: "Süper beğeni! ⭐",
          body: `${fromPet.name} seni süper beğendi.`,
          data: { type: "super_like" },
        },
      });
      return json({ status: result });
    }

    if (body.type === "new_candidate") {
      const { data: newPet, error: petError } = await admin
        .from("pets")
        .select(
          "id,owner_id,name,species,birth_date,latitude,longitude,goals,is_active,created_at",
        )
        .eq("id", body.petId)
        .single();
      if (
        petError ||
        !newPet?.is_active ||
        newPet.owner_id !== authData.user.id ||
        !newPet.goals?.includes("playdate")
      ) {
        return json({ error: "New candidate pet not found" }, 404);
      }

      const [{ data: ownerProfile }, { data: preferences, error: preferencesError }] =
        await Promise.all([
          admin
            .from("profiles")
            .select(
              "owner_visibility,avatar_url,owner_social_open,verification_status,require_visible_owner",
            )
            .eq("id", newPet.owner_id)
            .single(),
          admin
            .from("discovery_preferences")
            .select(
              "user_id,species,max_distance_km,min_age_years,max_age_years,require_owner_photo,require_owner_social,require_verified_owner,notify_on_new_candidates",
            )
            .eq("notify_on_new_candidates", true)
            .contains("species", [newPet.species])
            .neq("user_id", newPet.owner_id)
            .limit(500),
        ]);
      if (preferencesError) throw preferencesError;
      if (!ownerProfile || !preferences?.length) return json({ status: [] });

      const preferenceUserIds = preferences.map(({ user_id }) => user_id);
      const [
        { data: viewerPets, error: viewerPetError },
        { data: viewerProfiles, error: viewerProfileError },
        { data: blocks, error: blocksError },
      ] = await Promise.all([
        admin
          .from("pets")
          .select("owner_id,latitude,longitude,is_active,goals")
          .in("owner_id", preferenceUserIds)
          .eq("is_active", true),
        admin
          .from("profiles")
          .select("id,owner_visibility")
          .in("id", preferenceUserIds),
        admin
          .from("blocks")
          .select("blocker_id,blocked_id")
          .or(`blocker_id.eq.${newPet.owner_id},blocked_id.eq.${newPet.owner_id}`),
      ]);
      if (viewerPetError) throw viewerPetError;
      if (viewerProfileError) throw viewerProfileError;
      if (blocksError) throw blocksError;

      const blockedIds = new Set(
        (blocks ?? []).map((block) =>
          block.blocker_id === newPet.owner_id ? block.blocked_id : block.blocker_id
        ),
      );
      const viewerPetByOwner = new Map(
        (viewerPets ?? [])
          .filter((pet) => pet.goals?.includes("playdate"))
          .map((pet) => [pet.owner_id, pet]),
      );
      const viewerProfileById = new Map(
        (viewerProfiles ?? []).map((profile) => [profile.id, profile]),
      );
      const age = petAgeYears(newPet.birth_date);
      const recipients = preferences.filter((preference) => {
        const viewerPet = viewerPetByOwner.get(preference.user_id);
        const viewerProfile = viewerProfileById.get(preference.user_id);
        if (!viewerPet || !viewerProfile || blockedIds.has(preference.user_id)) {
          return false;
        }
        if (
          ownerProfile.require_visible_owner &&
          viewerProfile.owner_visibility === "hidden"
        ) {
          return false;
        }
        if (
          preference.require_owner_photo &&
          (!ownerProfile.avatar_url || ownerProfile.owner_visibility !== "public")
        ) {
          return false;
        }
        if (preference.require_owner_social && !ownerProfile.owner_social_open) {
          return false;
        }
        if (
          preference.require_verified_owner &&
          ownerProfile.verification_status !== "approved"
        ) {
          return false;
        }
        if (
          age !== null &&
          ((preference.min_age_years !== null &&
            age < Number(preference.min_age_years)) ||
            (preference.max_age_years !== null &&
              age > Number(preference.max_age_years)))
        ) {
          return false;
        }
        if (
          newPet.latitude !== null &&
          newPet.longitude !== null &&
          viewerPet.latitude !== null &&
          viewerPet.longitude !== null &&
          haversineKm(
            newPet.latitude,
            newPet.longitude,
            viewerPet.latitude,
            viewerPet.longitude,
          ) > preference.max_distance_km
        ) {
          return false;
        }
        return true;
      });

      const results = await Promise.all(
        recipients.map(({ user_id }) =>
          claimAndSend(admin, {
            eventType: "new_candidate",
            eventId: newPet.id,
            recipientId: user_id,
            content: {
              title: "Keşfette yeni bir pet var 🐾",
              body: `${newPet.name} filtrelerine uyuyor. Tanışmak için keşfete göz at.`,
              data: { type: "new_candidate" },
            },
          }),
        ),
      );
      return json({ status: results });
    }

    const { data: message, error: messageError } = await admin
      .from("messages")
      .select("id,conversation_id,sender_id")
      .eq("id", body.messageId)
      .single();
    if (messageError || message?.sender_id !== authData.user.id) {
      return json({ error: "Message not found" }, 404);
    }

    const [{ data: conversation }, { data: participants, error: participantError }] =
      await Promise.all([
        admin
          .from("conversations")
          .select("is_active")
          .eq("id", message.conversation_id)
          .single(),
        admin
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", message.conversation_id),
      ]);
    if (!conversation?.is_active) return json({ error: "Conversation is closed" }, 409);
    if (participantError) throw participantError;

    const recipients = (participants ?? []).filter(
      ({ user_id }) => user_id !== authData.user.id,
    );
    const results = await Promise.all(
      recipients.map(({ user_id }) =>
        claimAndSend(admin, {
          eventType: "message",
          eventId: message.id,
          recipientId: user_id,
          content: {
            title: "Yeni mesaj",
            body: "PetMatch’te yeni bir mesajın var.",
            data: {
              type: "message",
              conversationId: message.conversation_id,
            },
          },
        }),
      ),
    );
    return json({ status: results });
  } catch (error) {
    console.error(error);
    return json(
      { error: error instanceof Error ? error.message : "Notification failed" },
      500,
    );
  }
});
