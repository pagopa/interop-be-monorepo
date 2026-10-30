import node from "pagopa-interop-eslint-config/node";

export default [
  ...node,
  { ignores: ["dist/**", "postcss.config.js", "tailwind.config.ts", "vite.config.ts"] },
  {
    files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLSelectElement: "readonly",
        AbortController: "readonly",
        RequestInit: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
      },
    },
  },
];
