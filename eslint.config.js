const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/**",
      "web-build/**",
      "node_modules/**",
      "types/database.ts",
      // Deno Edge Functions `npm:` importlarını Supabase bundler doğrular.
      "supabase/functions/**",
    ],
  },
]);
