import node from "pagopa-interop-eslint-config/node";

export default [
  ...node,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      parserOptions: { projectService: false },
      globals: { process: "readonly" },
    },
    rules: {
      "@typescript-eslint/switch-exhaustiveness-check": "off",
    },
  },
];
