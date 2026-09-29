import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AdminClient = ReturnType<typeof createClient>;

/**
 * Önek altındaki TÜM nesneler. `list` sayfalı (100) ve alt klasörlere
 * inmiyor; eskisi yalnızca ilk 100 dosyayı ve tek seviyeyi siliyordu.
 * Klasör girdileri `id: null` döner.
 */
async function listAll(admin: AdminClient, bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  const pending = [prefix];
  while (pending.length) {
    const folder = pending.pop()!;
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(folder, { limit: 100, offset });
      if (error) throw error;
      for (const entry of data ?? []) {
        const path = `${folder}/${entry.name}`;
        if (entry.id === null) pending.push(path);
        else paths.push(path);
      }
      if (!data || data.length < 100) break;
    }
  }
  return paths;
}

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

    // SIRA: Storage önce, Auth kullanıcısı sonra. Tersi mümkün değil:
    // Supabase, Storage'da nesnesi olan kullanıcıyı silmeyi reddediyor.
    // Bedeli: `deleteUser` düşerse hesap fotoğrafsız kalır — istemci
    // hatayı görür ve tekrar dener; ikinci deneme boş listeyle ilerler.
    const petPhotoPaths = new Set<string>();
    const verificationPaths = new Set<string>();

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
      for (const { storage_path } of photos ?? []) petPhotoPaths.add(storage_path);
    }
    for (const path of await listAll(admin, "pet-photos", userId)) petPhotoPaths.add(path);
    for (const path of await listAll(admin, "verification-photos", userId)) {
      verificationPaths.add(path);
    }
    const avatarPaths = await listAll(admin, "owner-avatars", userId);

    const removals: [string, string[]][] = [
      ["pet-photos", [...petPhotoPaths]],
      ["verification-photos", [...verificationPaths]],
      ["owner-avatars", avatarPaths],
    ];
    for (const [bucket, paths] of removals) {
      for (let index = 0; index < paths.length; index += 100) {
        const { error: removeError } = await admin.storage
          .from(bucket)
          .remove(paths.slice(index, index + 100));
        if (removeError) throw removeError;
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;
    return json({ deleted: true });
  } catch (error) {
    // İç hata metni (tablo/kolon adları, Storage yolları) istemciye dönmez.
    console.error(error);
    return json({ error: "Account deletion failed" }, 500);
  }
});
