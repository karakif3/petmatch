#!/usr/bin/env node

import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

const email = process.env.PETMATCH_QA_EMAIL ?? "test1@petmatch.app";
const password = process.env.PETMATCH_SEED_PASSWORD;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!password || !supabaseUrl || !anonKey) {
  console.error(
    "PETMATCH_SEED_PASSWORD, EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY gerekli.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: signIn, error: signInError } =
  await supabase.auth.signInWithPassword({ email, password });
if (signInError) {
  throw new Error(`${email}: giriş başarısız (${signInError.message})`);
}

const { data: removed, error: deleteError } = await supabase
  .from("swipes")
  .delete()
  .eq("actor_id", signIn.user.id)
  .select("id");
if (deleteError) {
  throw new Error(`${email}: swipe kayıtları silinemedi (${deleteError.message})`);
}

console.log(`✓ ${email} keşfet destesi yenilendi · ${removed.length} karar sıfırlandı`);
