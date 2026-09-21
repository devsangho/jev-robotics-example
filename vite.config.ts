import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const repository =
  process.env.GITHUB_REPOSITORY?.split("/")[1] || "jev-robotics-example";
const base =
  process.env.GITHUB_PAGES === "true" && !repository.endsWith(".github.io")
    ? `/${repository}/`
    : "/";
export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ["three"], react: ["react", "react-dom"] },
      },
    },
  },
});
