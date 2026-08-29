#!/usr/bin/env node

import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

const password = process.env.PETMATCH_SEED_PASSWORD;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!password || !supabaseUrl || !anonKey) {
  console.error(
    "PETMATCH_SEED_PASSWORD, EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY gerekli.",
  );
  process.exit(1);
}

const seeds = [
  ["test1@petmatch.app", "photo-1552053831-71594a27632d"],
  ["deniz@petmatch.test", "photo-1543466835-00a7907e9de1"],
  ["ece@petmatch.test", "photo-1518717758536-85ae29035b6d"],
  ["mert@petmatch.test", "photo-1537151625747-768eb6cf92b2"],
  ["ayse@petmatch.test", "photo-1514888286974-6c03e2ca1dba"],
  ["nisa@petmatch.test", "photo-1583337130417-3346a1be7dee"],
  ["cem@petmatch.test", "photo-1573865526739-10659fec78a5"],
  ["defne@petmatch.test", "photo-1495360010541-f48722b34f7d"],
  ["selin@petmatch.test", "photo-1558788353-f76d92427f16"],
  ["kaan@petmatch.test", "photo-1533738363-b7f9aef128ce"],
  ["onur@petmatch.test", "photo-1561037404-61cd46aa615b"],
  ["yagmur@petmatch.test", "photo-1592194996308-7b43878e84a6"],
  ["burak@petmatch.test", "photo-1526336024174-e58f5cdd8e13"],
  ["elif@petmatch.test", "photo-1543852786-1cf6624b9987"],
  ["baran@petmatch.test", "photo-1608416947274-51c1ea89eeda"],
];

function imageUrl(photoId) {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&fm=jpg&w=900&h=1200&q=85`;
}

async function seedAccount(email, photoId) {
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`${email}: giriş başarısız (${signInError.message})`);

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select("id,name")
    .eq("is_active", true)
    .maybeSingle();
  if (petError || !pet) throw new Error(`${email}: aktif pet bulunamadı`);

  const { data: cover, error: coverError } = await supabase
    .from("pet_photos")
    .select("storage_path")
    .eq("pet_id", pet.id)
    .order("position")
    .limit(1)
    .maybeSingle();
  if (coverError || !cover) throw new Error(`${email}: kapak fotoğrafı kaydı bulunamadı`);

  const response = await fetch(imageUrl(photoId));
  if (!response.ok) throw new Error(`${email}: görsel indirilemedi (${response.status})`);
  const bytes = await response.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("pet-photos")
    .upload(cover.storage_path, bytes, { contentType: "image/jpeg", upsert: true });
  if (uploadError) throw new Error(`${email}: yükleme başarısız (${uploadError.message})`);

  console.log(`✓ ${pet.name} (${email})`);
}

for (const [email, photoId] of seeds) {
  await seedAccount(email, photoId);
}

console.log(`\n${seeds.length} QA pet fotoğrafı yenilendi.`);
