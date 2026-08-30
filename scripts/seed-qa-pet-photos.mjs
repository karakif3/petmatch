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

const extraPetPhotoIds = [
  "photo-1543466835-00a7907e9de1",
  "photo-1518717758536-85ae29035b6d",
];

const ownerPhotoIds = [
  "photo-1494790108377-be9c29b29330",
  "photo-1500648767791-00dcc994a43e",
  "photo-1534528741775-53994a69daeb",
  "photo-1507003211169-0a1dd7228f2d",
  "photo-1531123897727-8f129e1688ce",
  "photo-1506794778202-cad84cf45f1d",
];

const imageCache = new Map();

function imageUrl(photoId) {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&fm=jpg&w=900&h=1200&q=85`;
}

async function imageBytes(photoId) {
  if (!imageCache.has(photoId)) {
    imageCache.set(
      photoId,
      fetch(imageUrl(photoId)).then(async (response) => {
        if (!response.ok) {
          throw new Error(`${photoId}: görsel indirilemedi (${response.status})`);
        }
        return response.arrayBuffer();
      }),
    );
  }
  return imageCache.get(photoId);
}

async function uploadPhoto(supabase, bucket, storagePath, photoId) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, await imageBytes(photoId), {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (error) throw error;
  return storagePath;
}

async function seedAccount(email, coverPhotoId, accountIndex) {
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`${email}: giriş başarısız (${signInError.message})`);

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select("id,name")
    .eq("is_active", true)
    .maybeSingle();
  if (petError || !pet) throw new Error(`${email}: aktif pet bulunamadı`);

  const { data: petPhotos, error: petPhotosError } = await supabase
    .from("pet_photos")
    .select("storage_path")
    .eq("pet_id", pet.id)
    .order("position")
  if (petPhotosError || !petPhotos?.length) {
    throw new Error(`${email}: pet fotoğrafı kaydı bulunamadı`);
  }

  const { data: ownerPhotos, error: ownerPhotosError } = await supabase
    .from("owner_photos")
    .select("storage_path")
    .eq("owner_id", signIn.user.id)
    .order("position");
  if (ownerPhotosError) {
    throw new Error(`${email}: sahip fotoğrafları alınamadı (${ownerPhotosError.message})`);
  }

  const nextPetPaths = [];
  // Destede tek fotoğrafın yanı sıra karusel davranışını da her zaman
  // test edebilmek için ilk QA hesaplarında galeriyi bilinçli büyütürüz.
  const qaPhotoCount = accountIndex < 6 ? 3 : accountIndex < 10 ? 2 : 1;
  const petPhotoCount = Math.max(petPhotos.length, qaPhotoCount);
  for (let position = 0; position < petPhotoCount; position += 1) {
    const photoId =
      position === 0
        ? coverPhotoId
        : extraPetPhotoIds[(accountIndex + position - 1) % extraPetPhotoIds.length];
    const storagePath = `${signIn.user.id}/${pet.id}/qa-${position}-${photoId}.jpg`;
    try {
      nextPetPaths.push(
        await uploadPhoto(supabase, "pet-photos", storagePath, photoId),
      );
    } catch (error) {
      throw new Error(`${email}: pet fotoğrafı yüklenemedi (${error.message})`);
    }
  }
  const { error: petOrderError } = await supabase.rpc("replace_pet_photo_order", {
    p_pet_id: pet.id,
    p_storage_paths: nextPetPaths,
  });
  if (petOrderError) {
    throw new Error(`${email}: pet galerisi güncellenemedi (${petOrderError.message})`);
  }

  const nextOwnerPaths = [];
  const ownerPhotoCount = accountIndex < 6 ? 3 : accountIndex < 10 ? 2 : 0;
  for (let position = 0; position < ownerPhotoCount; position += 1) {
    const photoId = ownerPhotoIds[(accountIndex + position) % ownerPhotoIds.length];
    const storagePath = `${signIn.user.id}/qa-owner-${position}-${photoId}.jpg`;
    try {
      nextOwnerPaths.push(
        await uploadPhoto(supabase, "owner-avatars", storagePath, photoId),
      );
    } catch (error) {
      throw new Error(`${email}: sahip fotoğrafı yüklenemedi (${error.message})`);
    }
  }
  if (nextOwnerPaths.length) {
    const { error: ownerOrderError } = await supabase.rpc("replace_owner_photo_order", {
      p_storage_paths: nextOwnerPaths,
    });
    if (ownerOrderError) {
      throw new Error(`${email}: sahip galerisi güncellenemedi (${ownerOrderError.message})`);
    }
  }

  const stalePetPaths = petPhotos
    .map((photo) => photo.storage_path)
    .filter((path) => !nextPetPaths.includes(path));
  const discardedLegacySeedPaths = petPhotos.map((_, position) => {
    const photoId =
      position === 0
        ? coverPhotoId
        : extraPetPhotoIds[(accountIndex + position - 1) % extraPetPhotoIds.length];
    return `${signIn.user.id}/qa-pet-${pet.id}-${position}-${photoId}.jpg`;
  });
  const staleOwnerPaths = (ownerPhotos ?? [])
    .map((photo) => photo.storage_path)
    .filter((path) => !nextOwnerPaths.includes(path));
  if (stalePetPaths.length || discardedLegacySeedPaths.length) {
    await supabase.storage
      .from("pet-photos")
      .remove([...stalePetPaths, ...discardedLegacySeedPaths]);
  }
  if (staleOwnerPaths.length) {
    await supabase.storage.from("owner-avatars").remove(staleOwnerPaths);
  }

  console.log(
    `✓ ${pet.name} (${email}) · ${petPhotoCount} pet, ${ownerPhotoCount} sahip fotoğrafı`,
  );
}

for (const [index, [email, photoId]] of seeds.entries()) {
  await seedAccount(email, photoId, index);
}

console.log(`\n${seeds.length} QA hesabının mevcut galerileri yenilendi.`);
