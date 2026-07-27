import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  // public/search-index is generated third-party output from `npm run search:index`.
  globalIgnores([".next/**", "coverage/**", "next-env.d.ts", "public/search-index/**"]),
])
