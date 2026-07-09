// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Deno edge functions run on Supabase, not in the RN app — keep them out of the app's lint.
    ignores: ["dist/*", "supabase/**"],
  }
]);
