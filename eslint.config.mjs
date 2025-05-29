import pagopa from "@pagopa/eslint-config";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import functional from "eslint-plugin-functional";
import sonarjs from "eslint-plugin-sonarjs";
import fp from "eslint-plugin-fp";
import perfectionist from "eslint-plugin-perfectionist";

const __dirname = dirname(fileURLToPath(import.meta.url));
// turn every perfectionist rule off in one go
const offPerfectionist = Object.fromEntries(
  Object.keys(perfectionist.rules).map((r) => [`perfectionist/${r}`, "off"])
);

export default [
  {
    ignores: [
      "vitest.config.ts",
      "**/src/model/generated/**/*.ts",
      "**/src/generated/**/*.ts",
      "**/dist",
      "**/patchZodios.ts",
      "**/paged.polyfill.js",
    ],
  },
  {
    // TODO these don't seem to be working, consider removing them...
    plugins: {
      functional,
      sonarjs,
      fp,
    },
  },
  ...pagopa,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: "./tsconfig.eslint.json",
      },
    },
    rules: {
      // Any project level custom rule
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "default-case": "off",
      "prefer-arrow/prefer-arrow-functions": "off",
      eqeqeq: ["error", "smart"],
      "@typescript-eslint/consistent-type-definitions": "off",
      "sort-keys": "off",
      "functional/prefer-readonly-type": "off",
      "@typescript-eslint/no-shadow": "off",
      "extra-rules/no-commented-out-code": "off",
      "sonarjs/no-duplicate-string": "off",
      "max-lines-per-function": "off",
      "@typescript-eslint/naming-convention": "off",
      "@typescript-eslint/no-use-before-define": "off",

      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@typescript-eslint/no-inferrable-types": "off",

      "prettier/prettier": ["off"],
    },
  },
  {
    // globally disable eslint-plugin-prettier and all perfectionist rules
    rules: {
      "prettier/prettier": "off",
      ...offPerfectionist,
    },
  },
];
