// @ts-check
import { defineConfig } from "rollup";
import typescript from "@rollup/plugin-typescript";
import nodeResolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import commonjs from "@rollup/plugin-commonjs";
import { del } from '@kineticcafe/rollup-plugin-delete'

export default defineConfig({
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "cjs",
    sourcemap: true,
  },
  plugins: [
    typescript({ noEmitOnError: true }),
    nodeResolve({ preferBuiltins: true }),
    json(),
    commonjs(),
    del({ targets: 'dist/*' })
  ],
  onwarn: (warning, rollupWarn) => {
    if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.ids?.every(id => id.includes('node_modules'))) {
      // skip warnings for circular dependencies in node_modules
    } else {
      rollupWarn(warning)
    }
  }
});
