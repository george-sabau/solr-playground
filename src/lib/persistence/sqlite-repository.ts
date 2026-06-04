import { and, asc, eq } from "drizzle-orm";
import type Database from "better-sqlite3";
import {
  deserializeTemplatePayload,
  serializeTemplatePayload,
} from "@/lib/query/template-types";
import type { QueryParserMode } from "@/lib/query/types";
import type { QueryTemplatePayload } from "@/lib/query/template-types";
import {
  createDefaultEndpoint,
  DEFAULT_ENDPOINT_ID,
  type SolrAuth,
  type SolrEndpoint,
} from "@/lib/solr/endpoints";
import { decryptSecret, encryptSecret } from "./crypto";
import { getDrizzle } from "./db";
import type { PersistenceRepository } from "./repository";
import { appSettings, queryBuilderTemplates, solrEndpoints } from "./schema";
import type { ConnectionState, QueryBuilderTemplateRecord } from "./types";
import { DuplicateTemplateNameError } from "./types";

const ACTIVE_ENDPOINT_KEY = "active_endpoint_id";

function rowToEndpoint(row: {
  id: string;
  label: string;
  baseUrl: string;
  authUser: string | null;
  authPassEncrypted: string | null;
  lastCore: string | null;
}): SolrEndpoint {
  let auth: SolrAuth | null = null;
  if (row.authUser) {
    const pass = row.authPassEncrypted
      ? decryptSecret(row.authPassEncrypted)
      : "";
    auth = { user: row.authUser, pass };
  }
  return {
    id: row.id,
    label: row.label,
    baseUrl: row.baseUrl,
    auth,
    lastCore: row.lastCore,
  };
}

export class SqlitePersistenceRepository implements PersistenceRepository {
  private readonly db = getDrizzle();

  constructor(_native?: Database.Database) {
    void _native;
  }

  hasAnyEndpoints(): boolean {
    const rows = this.db.select({ id: solrEndpoints.id }).from(solrEndpoints).all();
    return rows.length > 0;
  }

  getConnectionState(): ConnectionState {
    const rows = this.db
      .select()
      .from(solrEndpoints)
      .orderBy(asc(solrEndpoints.sortOrder))
      .all();

    const activeRow = this.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, ACTIVE_ENDPOINT_KEY))
      .get();

    const endpoints = rows.map(rowToEndpoint);
    const activeEndpointId =
      activeRow?.value ??
      endpoints[0]?.id ??
      DEFAULT_ENDPOINT_ID;

    return { endpoints, activeEndpointId };
  }

  saveConnectionState(state: ConnectionState): void {
    const native = this.db.$client;
    const now = new Date().toISOString();

    const tx = native.transaction(() => {
      native.prepare("DELETE FROM solr_endpoints").run();

      const insert = native.prepare(`
        INSERT INTO solr_endpoints (
          id, label, base_url, auth_user, auth_pass_encrypted, last_core, sort_order, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      state.endpoints.forEach((ep, index) => {
        const authUser = ep.auth?.user ?? null;
        const authPassEncrypted =
          ep.auth?.pass && ep.auth.pass.length > 0
            ? encryptSecret(ep.auth.pass)
            : null;
        insert.run(
          ep.id,
          ep.label,
          ep.baseUrl,
          authUser,
          authPassEncrypted,
          ep.lastCore,
          index,
          now
        );
      });

      native
        .prepare(
          `INSERT INTO app_settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        )
        .run(ACTIVE_ENDPOINT_KEY, state.activeEndpointId);
    });

    tx();
  }

  seedDefaultIfEmpty(): ConnectionState {
    if (this.hasAnyEndpoints()) {
      return this.getConnectionState();
    }
    const endpoint = createDefaultEndpoint();
    const state: ConnectionState = {
      endpoints: [endpoint],
      activeEndpointId: endpoint.id,
    };
    this.saveConnectionState(state);
    return state;
  }

  listQueryTemplates(
    endpointId: string,
    core: string
  ): QueryBuilderTemplateRecord[] {
    const rows = this.db
      .select()
      .from(queryBuilderTemplates)
      .where(
        and(
          eq(queryBuilderTemplates.endpointId, endpointId),
          eq(queryBuilderTemplates.core, core)
        )
      )
      .orderBy(asc(queryBuilderTemplates.name))
      .all();
    return rows.map(rowToTemplate);
  }

  getQueryTemplate(id: string): QueryBuilderTemplateRecord | null {
    const row = this.db
      .select()
      .from(queryBuilderTemplates)
      .where(eq(queryBuilderTemplates.id, id))
      .get();
    return row ? rowToTemplate(row) : null;
  }

  createQueryTemplate(input: {
    endpointId: string;
    core: string;
    name: string;
    parser: QueryParserMode;
    payload: QueryTemplatePayload;
  }): string {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const trimmedName = input.name.trim();
    try {
      this.db
        .insert(queryBuilderTemplates)
        .values({
          id,
          endpointId: input.endpointId,
          core: input.core,
          name: trimmedName,
          parser: input.parser,
          payloadJson: serializeTemplatePayload(input.payload),
          createdAt: now,
          updatedAt: now,
        })
        .run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("UNIQUE constraint failed")) {
        throw new DuplicateTemplateNameError(trimmedName, input.core);
      }
      throw e;
    }
    return id;
  }

  updateQueryTemplate(
    id: string,
    input: {
      parser: QueryParserMode;
      payload: QueryTemplatePayload;
    }
  ): void {
    const existing = this.getQueryTemplate(id);
    if (!existing) {
      throw new Error(`Template not found: ${id}`);
    }
    const now = new Date().toISOString();
    this.db
      .update(queryBuilderTemplates)
      .set({
        parser: input.parser,
        payloadJson: serializeTemplatePayload(input.payload),
        updatedAt: now,
      })
      .where(eq(queryBuilderTemplates.id, id))
      .run();
  }

  deleteQueryTemplate(id: string): void {
    this.db
      .delete(queryBuilderTemplates)
      .where(eq(queryBuilderTemplates.id, id))
      .run();
  }
}

function rowToTemplate(row: {
  id: string;
  endpointId: string;
  core: string;
  name: string;
  parser: string;
  payloadJson: string;
  createdAt: string;
  updatedAt: string;
}): QueryBuilderTemplateRecord {
  return {
    id: row.id,
    endpointId: row.endpointId,
    core: row.core,
    name: row.name,
    parser: row.parser as QueryParserMode,
    payload: deserializeTemplatePayload(row.payloadJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
