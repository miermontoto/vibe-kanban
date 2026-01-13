// vite.config.ts
import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

function executorSchemasPlugin(): Plugin {
  const VIRTUAL_ID = "virtual:executor-schemas";
  const RESOLVED_VIRTUAL_ID = "\0" + VIRTUAL_ID;

  return {
    name: "executor-schemas-plugin",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID; // keep it virtual
      return null;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return null;

      const schemasDir = path.resolve(__dirname, "../shared/schemas");
      const files = fs.existsSync(schemasDir)
        ? fs.readdirSync(schemasDir).filter((f) => f.endsWith(".json"))
        : [];

      const imports: string[] = [];
      const entries: string[] = [];

      files.forEach((file, i) => {
        const varName = `__schema_${i}`;
        const importPath = `shared/schemas/${file}`; // uses your alias
        const key = file.replace(/\.json$/, "").toUpperCase(); // claude_code -> CLAUDE_CODE
        imports.push(`import ${varName} from "${importPath}";`);
        entries.push(`  "${key}": ${varName}`);
      });

      // IMPORTANT: pure JS (no TS types), and quote keys.
      const code = `
${imports.join("\n")}

export const schemas = {
${entries.join(",\n")}
};

export default schemas;
`;
      return code;
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    executorSchemasPlugin(),
  ],
  define: {
    // Exponer puerto del backend al cliente para conexiones WebSocket directas
    'import.meta.env.VITE_BACKEND_PORT': JSON.stringify(process.env.BACKEND_PORT || "3001"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      shared: path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    port: parseInt(process.env.FRONTEND_PORT || "3000"),
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.BACKEND_PORT || "3001"}`,
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          console.log(`[vite proxy] Configured for backend on port ${process.env.BACKEND_PORT || "3001"}`);

          // silencia errores de conexión esperados durante reinicios del backend
          proxy.on("error", (err) => {
            const code = (err as NodeJS.ErrnoException).code;
            const name = err.name;
            console.log("[vite proxy] Error:", { code, name, message: err.message });
            // ignora errores de conexión comunes durante reinicios
            if (code === "ECONNRESET" || code === "ECONNREFUSED") return;
            if (name === "AggregateError") return; // múltiples errores de conexión
            console.error("[vite proxy]", err.message);
          });

          proxy.on("proxyReq", (proxyReq, req) => {
            if (req.url?.includes("/ws")) {
              console.log("[vite proxy] WebSocket upgrade request:", req.url);
            }
          });
        },
      },
    },
    fs: {
      allow: [path.resolve(__dirname, "."), path.resolve(__dirname, "..")],
    },
    open: process.env.VITE_OPEN === "true",
    allowedHosts: [
      ".trycloudflare.com", // allow all cloudflared tunnels
    ],
  },
  optimizeDeps: {
    exclude: ["wa-sqlite"],
  },
  build: { sourcemap: true },
});
