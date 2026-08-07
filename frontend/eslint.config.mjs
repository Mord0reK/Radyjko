import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  {
    rules: {
      "react-refresh/only-export-components": "warn",
    },
  },
  globalIgnores([
    "coverage/**",
    "dist/**",
    ".wrangler/**",
    "src-tauri/target/**",
    "cloudflare-env.d.ts",
  ]),
]);

export default eslintConfig;
