import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "/__local-dashboard/",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 4546,
    proxy: {
      "/__local-dashboard/api": "http://127.0.0.1:4545",
    },
  },
});
