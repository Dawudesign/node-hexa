import { defineConfig } from "tsup";

const secret = process.env["NODEHEXA_LICENSE_SECRET"];
if (!secret) {
  throw new Error(
    "NODEHEXA_LICENSE_SECRET is not set. Export it before building:\n" +
    "  export NODEHEXA_LICENSE_SECRET=your_secret_here",
  );
}

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  bundle: true,
  // Bake the secret into the compiled binary at build time.
  // The end user's machine never needs this env variable.
  env: {
    NODEHEXA_LICENSE_SECRET: secret,
  },
});
