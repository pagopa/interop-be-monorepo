module.exports = {
  extends: ["@pagopa/eslint-config/strong"],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./packages/*/tsconfig.json"],
  },
  rules: {
    // Any project level custom rule
    "prefer-arrow/prefer-arrow-functions": "off",
    eqeqeq: ["error", "smart"],
    "@typescript-eslint/consistent-type-definitions": "off",
    "sort-keys": "off",
    "functional/prefer-readonly-type": "off",
    "@typescript-eslint/no-shadow": "off",
    "extra-rules/no-commented-out-code": "off",
    "sonarjs/no-duplicate-string": "off",
  },
  ignorePatterns: [".eslintrc.cjs", "**/src/model/generated/*.ts"],
};
