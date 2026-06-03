import path from "node:path";
import { createRequire } from "node:module";
import fs from "node:fs";
import postcss from "postcss";

/** Always use cwd — import.meta.url is unreliable inside Turbopack's PostCSS runner. */
const projectRoot = process.env.SOLR_PLAYGROUND_ROOT
  ? path.resolve(process.env.SOLR_PLAYGROUND_ROOT)
  : process.cwd();
const require = createRequire(path.join(projectRoot, "package.json"));

const vendorFiles = [
  path.join(projectRoot, "node_modules/tailwindcss/index.css"),
  path.join(projectRoot, "node_modules/tw-animate-css/dist/tw-animate.css"),
  path.join(projectRoot, "node_modules/shadcn/dist/tailwind.css"),
];

/** Inject vendor CSS via absolute paths — bypasses parent lockfile module resolution. */
function inlineVendorCss() {
  return {
    postcssPlugin: "solr-playground-inline-vendor-css",
    Once(root, { result }) {
      const from = (result.opts.from ?? "").replace(/\\/g, "/");
      if (!from.endsWith("/src/app/globals.css")) {
        return;
      }

      for (const file of vendorFiles) {
        if (!fs.existsSync(file)) {
          throw new Error(
            `[postcss] Missing ${file}. Run npm ci from ${projectRoot}.`,
          );
        }
        root.prepend(postcss.parse(fs.readFileSync(file, "utf8"), { from: file }));
      }

      root.walkAtRules("import", (rule) => {
        const params = rule.params.replace(/['"]/g, "").trim();
        if (
          params === "tailwindcss" ||
          params === "tw-animate-css" ||
          params === "shadcn/tailwind.css"
        ) {
          rule.remove();
        }
      });
    },
  };
}
inlineVendorCss.postcss = true;

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: [
    inlineVendorCss(),
    [require.resolve("@tailwindcss/postcss"), {}],
  ],
};

export default config;
