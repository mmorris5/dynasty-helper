import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves project sites from /<repo>/. Set BASE_PATH in CI.
// For a user/organization page (<user>.github.io) set BASE_PATH=/
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? "/dynasty-helper/",
  build: { outDir: "dist", sourcemap: false },
});
