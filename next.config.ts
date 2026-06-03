import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function nm(...segments: string[]): string {
  return path.join(projectRoot, "node_modules", ...segments);
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "sqlite-vec"],
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      tailwindcss: nm("tailwindcss"),
      "tailwindcss/index.css": nm("tailwindcss", "index.css"),
      "tw-animate-css": nm("tw-animate-css"),
      shadcn: nm("shadcn"),
      "shadcn/tailwind.css": nm("shadcn", "dist", "tailwind.css"),
    },
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    const alias = config.resolve.alias as Record<string, string>;
    alias.tailwindcss = nm("tailwindcss");
    alias["tw-animate-css"] = nm("tw-animate-css");
    alias.shadcn = nm("shadcn");
    return config;
  },
};

export default nextConfig;
