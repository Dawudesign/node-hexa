import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: true,
  bundle: true,
  platform: "node",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
