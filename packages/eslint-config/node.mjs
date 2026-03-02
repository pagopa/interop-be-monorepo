import pagopa from "@pagopa/eslint-config";

const commonRestrictedImports = ["**/dist/**"];

// Stub plugins so that legacy eslint-disable comments referencing
// rules from plugins removed in v5 don't cause "Definition not found" errors.
const noopRule = { meta: { type: "suggestion" }, create: () => ({}) };
const legacyPlugins = {
  functional: {
    rules: {
      "immutable-data": noopRule,
      "no-let": noopRule,
    },
  },
  sonarjs: {
    rules: {
      "cognitive-complexity": noopRule,
      "no-duplicated-branches": noopRule,
      "no-identical-functions": noopRule,
      "no-nested-template-literals": noopRule,
    },
  },
  fp: {
    rules: {
      "no-delete": noopRule,
    },
  },
};

export default [
  ...pagopa,
  {
    plugins: legacyPlugins,
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-generic-constructors": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          caughtErrors: "none",
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "complexity": "off",
      "max-lines-per-function": "off",
      "perfectionist/sort-array-includes": "off",
      "perfectionist/sort-classes": "off",
      "perfectionist/sort-decorators": "off",
      "perfectionist/sort-enums": "off",
      "perfectionist/sort-exports": "off",
      "perfectionist/sort-heritage-clauses": "off",
      "perfectionist/sort-imports": "off",
      "perfectionist/sort-interfaces": "off",
      "perfectionist/sort-intersection-types": "off",
      "perfectionist/sort-jsx-props": "off",
      "perfectionist/sort-maps": "off",
      "perfectionist/sort-modules": "off",
      "perfectionist/sort-named-exports": "off",
      "perfectionist/sort-named-imports": "off",
      "perfectionist/sort-object-types": "off",
      "perfectionist/sort-objects": "off",
      "perfectionist/sort-sets": "off",
      "perfectionist/sort-switch-case": "off",
      "perfectionist/sort-union-types": "off",
      "perfectionist/sort-variable-declarations": "off",
      "prettier/prettier": ["error", { "trailingComma": "es5" }],
      "no-restricted-imports": [
        "error",
        { patterns: commonRestrictedImports },
      ],
    },
  },
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
  {
    files: ["**/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    ignores: [
      "eslint.config.mjs",
      "**/vitest.config.ts",
      "**/vitest.*.config.ts",
      "**/src/model/generated/**/*.ts",
      "**/src/generated/**/*.ts",
      "**/patchZodios.ts",
      "**/paged.polyfill.js",
      "**/drizzle.config.ts",
      "**/generate.ts",
      "index.ts",
      "**/scripts/**",
    ],
  },
];
