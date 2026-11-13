import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// All Nexus calls happen in the backend. The browser only talks to /api.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
});
