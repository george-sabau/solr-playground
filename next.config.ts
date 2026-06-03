import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Pin workspace root — avoids picking a parent folder when multiple lockfiles exist. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "sqlite-vec"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
