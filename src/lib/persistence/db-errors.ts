export function formatDbError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("NODE_MODULE_VERSION") ||
    message.includes("better_sqlite3.node") ||
    message.includes("was compiled against a different Node.js version")
  ) {
    return (
      "SQLite native module mismatch (Node version changed since npm install). " +
      "Run: npm run rebuild:native — or npm run dev:stack (auto-rebuilds for Node 22)."
    );
  }
  return message || "Database error";
}
