import node from "pagopa-interop-eslint-config/node";

export default [
  ...node,
  {
    files: ["test/**/*.ts", "vitest.config.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.check.json",
      },
    },
  },
];
