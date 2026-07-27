import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  try {
    const userId = authData.user.id;
    const { data: pets, error: petsError } = await admin
      .from("pets")
      .select("id")
      .eq("owner_id", userId);
    if (petsError) throw petsError;

    const petIds = (pets ?? []).map(({ id }) => id);
    if (petIds.length) {
      const { data: photos, error: photosError } = await admin
        .from("pet_photos")
        .select("storage_path")
        .in("pet_id", petIds);
      if (photosError) throw photosError;
      const paths = new Set((photos ?? []).map(({ storage_path }) => storage_path));
      for (const petId of petIds) {
        const { data: storedFiles, error: listError } = await admin.storage
          .from("pet-photos")
          .list(`${userId}/${petId}`, { limit: 100 });
        if (listError) throw listError;
        for (const file of storedFiles ?? []) {
          paths.add(`${userId}/${petId}/${file.name}`);
        }
      }
      if (paths.size) {
        const { error: storageError } = await admin.storage
          .from("pet-photos")
          .remove([...paths]);
        if (storageError) throw storageError;
      }

      const verificationPaths = new Set<string>();
      for (const petId of petIds) {
        const { data: verificationFiles, error: verificationListError } =
          await admin.storage
            .from("verification-photos")
            .list(`${userId}/${petId}`, { limit: 100 });
        if (verificationListError) throw verificationListError;
        for (const file of verificationFiles ?? []) {
          verificationPaths.add(`${userId}/${petId}/${file.name}`);
        }
      }
      if (verificationPaths.size) {
        const { error: verificationDeleteError } = await admin.storage
          .from("verification-photos")
          .remove([...verificationPaths]);
        if (verificationDeleteError) throw verificationDeleteError;
      }
    }

    const { data: avatarFiles, error: avatarListError } = await admin.storage
      .from("owner-avatars")
      .list(userId, { limit: 100 });
    if (avatarListError) throw avatarListError;
    if (avatarFiles?.length) {
      const { error: avatarDeleteError } = await admin.storage
        .from("owner-avatars")
        .remove(avatarFiles.map(({ name }) => `${userId}/${name}`));
      if (avatarDeleteError) throw avatarDeleteError;
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;
    return json({ deleted: true });
  } catch (error) {
    console.error(error);
    return json(
      { error: error instanceof Error ? error.message : "Account deletion failed" },
      500,
    );
  }
});
