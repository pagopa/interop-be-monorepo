import pagopa from "@pagopa/eslint-config";
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
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
    },
    ignores: [
      ".eslintrc.cjs",
      "vitest.config.ts",
      "**/src/model/generated/**/*.ts",
      "**/src/generated/**/*.ts",
      "**/dist",
      "**/patchZodios.ts",
      "**/paged.polyfill.js",
    ],
  },
];
