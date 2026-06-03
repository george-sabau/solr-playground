import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const solrEndpoints = sqliteTable("solr_endpoints", {
  id: text("id").primaryKey(),
  label: text("label").notNull().default(""),
  baseUrl: text("base_url").notNull(),
  authUser: text("auth_user"),
  authPassEncrypted: text("auth_pass_encrypted"),
  lastCore: text("last_core"),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const queryBuilderTemplates = sqliteTable(
  "query_builder_templates",
  {
    id: text("id").primaryKey(),
    endpointId: text("endpoint_id").notNull(),
    core: text("core").notNull(),
    name: text("name").notNull(),
    parser: text("parser").notNull(),
    payloadJson: text("payload_json").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    uniqueNamePerCore: unique().on(t.endpointId, t.core, t.name),
  })
);
