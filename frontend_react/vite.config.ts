import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// eslint-disable-next-line no-control-regex
const INVALID_CHAR_REGEX = /[\u0000-\u001F"#$&*+,:;<=>?[\]^`{|}\u007F]/g;
const DRIVE_LETTER_REGEX = /^[a-z]:/i;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: mode === "production" ? "/__dynamic_base__/" : "/",
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: Number(env.VITE_APP_PORT || 3001),
      open: false,
      proxy: {
        // The panel API lives under /hui on the Go server.
        "/hui": {
          target: "http://127.0.0.1:8081",
          changeOrigin: true,
        },
      },
    },
    build: {
      target: "es2022",
      // One stylesheet for the whole app: it is small, shared by every route
      // and cached for a year once fetched.
      cssCodeSplit: false,
      // Byte counts that matter are printed by scripts/precompress.mjs, which
      // reports the compressed sizes actually served.
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          // React changes rarely and every route needs it, so it gets its own
          // chunk that stays valid across app-only deploys. Route modules are
          // split by the dynamic imports in App.tsx.
          manualChunks(id: string) {
            if (
              /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(
                id
              )
            ) {
              return "vendor-react";
            }
            return undefined;
          },
          sanitizeFileName(name: string): string {
            const match = DRIVE_LETTER_REGEX.exec(name);
            const driveLetter = match ? match[0] : "";
            return (
              driveLetter +
              name.slice(driveLetter.length).replace(INVALID_CHAR_REGEX, "")
            );
          },
        },
      },
    },
  };
});
