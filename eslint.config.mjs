import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next.
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local-only reference folders (gitignored, not part of the build).
    "Nobell-Decentralized-Equity-Marketplace/**",
    "docs/reference/**",
  ]),
]);

export default eslintConfig;
