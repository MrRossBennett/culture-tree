import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { loadEnv } from "vite";
import { defineConfig } from "vite-plus";

const webRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const mode = process.env.NODE_ENV === "production" ? "production" : "development";
for (const [key, value] of Object.entries(loadEnv(mode, webRoot, ""))) {
  if (process.env[key] === undefined && value !== "") {
    process.env[key] = value;
  }
}

export default defineConfig({
  run: {
    // Vite Task
    // https://viteplus.dev/config/run
    // https://viteplus.dev/guide/run
    // https://viteplus.dev/guide/cache
    tasks: {
      build: {
        // When deploying, use `vp run build` as the build command, not `vp build`
        command: "vp build",
        env: ["NODE_ENV", "VITE_*"],
        input: [
          { auto: true },
          "!**/.output/**",
          "!**/.vercel/**",
          "!**/.netlify/**",
          "!**/build/**",
          "!**/.wrangler/**",
          "!**/dist/**",
          "!**/*.tsbuildinfo",
          "!**/node_modules/.vite/**",
          "!**/node_modules/.vite-temp/**",
          "!**/node_modules/.nitro/**",
        ],
      },
    },
  },

  resolve: {
    tsconfigPaths: true,
    alias: {
      "@repo/schemas": resolve(repoRoot, "packages/schemas/src/index.ts"),
      "@repo/engine": resolve(repoRoot, "packages/engine/src/index.ts"),
    },
  },
  server: {
    port: 3000,
  },
  plugins: [
    devtools(),
    tanstackStart(),
    // https://tanstack.com/start/latest/docs/framework/react/guide/hosting
    nitro({
      // fixes SSR issues with Vite 8:
      // https://discord.com/channels/719702312431386674/1490005967067414608/1490634230458224751
      traceDeps: ["react", "react-dom"],
    }),
    viteReact(),
    // https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#react-compiler
    babel({
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
  ],
});
