import { build } from "esbuild";
import { writeFileSync } from "fs";

const result = await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/index.js",
  external: [
    "kafkajs",
    "pg",
    "pg-native",
    "drizzle-orm",
    "dotenv-flow",
  ],
  sourcemap: true,
  minify: false,
  treeShaking: true,
  metafile: true,
});

writeFileSync("dist/meta.json", JSON.stringify(result.metafile, null, 2));
