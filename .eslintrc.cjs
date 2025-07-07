const commonRestrictedImports = ["**/dist/**"];
module.exports = {
  extends: ["@pagopa/eslint-config/strong"],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: "./tsconfig.eslint.json",
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
    "no-restricted-imports": ["error", { patterns: commonRestrictedImports }],
  },
  ignorePatterns: [
    ".eslintrc.cjs",
    "vitest.config.ts",
    "**/src/model/generated/**/*.ts",
    "**/src/generated/**/*.ts",
    "**/dist",
    "**/patchZodios.ts",
    "**/paged.polyfill.js",
  ],
  overrides: [
    {
      files: ["**/src/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [...commonRestrictedImports, "**/testUtils"],
          },
        ],
      },
    },
  ],
};
