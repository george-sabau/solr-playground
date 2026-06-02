"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchSchemaCopyFields,
  fetchSchemaDynamicFields,
  fetchSchemaFieldTypes,
  fetchSchemaFields,
} from "@/lib/solr-client";
import { matchDynamicRule, type DynamicMatch } from "@/lib/schema/match-dynamic";
import { deriveLocale } from "@/lib/schema/locale";
import type {
  SchemaCopyField,
  SchemaDynamicField,
  SchemaField,
  SchemaFieldType,
} from "@/types/solr";

export interface FieldMeta {
  name: string;
  type: string | null;
  locale: string | null;
  isDynamic: boolean;
  staticDef: SchemaField | null;
  dynamicMatch: DynamicMatch | null;
  fieldType: SchemaFieldType | null;
}

export interface SchemaSnapshot {
  fields: SchemaField[];
  dynamicFields: SchemaDynamicField[];
  fieldTypes: SchemaFieldType[];
  copyFields: SchemaCopyField[];
}

interface SchemaContextValue {
  core: string | null;
  loading: boolean;
  error: string | null;
  schema: SchemaSnapshot | null;
  refresh: () => Promise<void>;
  getFieldMeta: (name: string) => FieldMeta;
  getFieldType: (name: string) => SchemaFieldType | null;
  copyFieldsBySource: Map<string, SchemaCopyField[]>;
  copyFieldsByDest: Map<string, SchemaCopyField[]>;
}

const SchemaContext = createContext<SchemaContextValue | null>(null);

const EMPTY_SCHEMA: SchemaSnapshot = {
  fields: [],
  dynamicFields: [],
  fieldTypes: [],
  copyFields: [],
};

export function SchemaProvider({
  core,
  baseUrl,
  children,
}: {
  core: string | null;
  baseUrl: string;
  children: ReactNode;
}) {
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!core) {
      setSchema(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [fieldsRes, dynRes, typesRes, copyRes] = await Promise.all([
        fetchSchemaFields(core),
        fetchSchemaDynamicFields(core),
        fetchSchemaFieldTypes(core),
        fetchSchemaCopyFields(core),
      ]);
      setSchema({
        fields: fieldsRes.fields ?? [],
        dynamicFields: dynRes.dynamicFields ?? [],
        fieldTypes: typesRes.fieldTypes ?? [],
        copyFields: copyRes.copyFields ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load schema");
      setSchema(null);
    } finally {
      setLoading(false);
    }
  }, [core]);

  useEffect(() => {
    // Subscribing this provider to (core, baseUrl) changes; load() handles its own state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, baseUrl]);

  const value = useMemo<SchemaContextValue>(() => {
    const snap = schema ?? EMPTY_SCHEMA;
    const fieldsByName = new Map<string, SchemaField>();
    for (const f of snap.fields) fieldsByName.set(f.name, f);
    const typesByName = new Map<string, SchemaFieldType>();
    for (const t of snap.fieldTypes) typesByName.set(t.name, t);

    const copyBySource = new Map<string, SchemaCopyField[]>();
    const copyByDest = new Map<string, SchemaCopyField[]>();
    for (const cf of snap.copyFields) {
      const s = copyBySource.get(cf.source) ?? [];
      s.push(cf);
      copyBySource.set(cf.source, s);
      const d = copyByDest.get(cf.dest) ?? [];
      d.push(cf);
      copyByDest.set(cf.dest, d);
    }

    const getFieldMeta = (name: string): FieldMeta => {
      const staticDef = fieldsByName.get(name) ?? null;
      if (staticDef) {
        const fieldType = typesByName.get(staticDef.type) ?? null;
        return {
          name,
          type: staticDef.type,
          locale: deriveLocale(staticDef.type),
          isDynamic: false,
          staticDef,
          dynamicMatch: null,
          fieldType,
        };
      }
      const dyn = matchDynamicRule(name, snap.dynamicFields);
      if (dyn) {
        const fieldType = typesByName.get(dyn.rule.type) ?? null;
        return {
          name,
          type: dyn.rule.type,
          locale: deriveLocale(dyn.rule.type),
          isDynamic: true,
          staticDef: null,
          dynamicMatch: dyn,
          fieldType,
        };
      }
      return {
        name,
        type: null,
        locale: null,
        isDynamic: false,
        staticDef: null,
        dynamicMatch: null,
        fieldType: null,
      };
    };

    const getFieldType = (name: string): SchemaFieldType | null =>
      typesByName.get(name) ?? null;

    return {
      core,
      loading,
      error,
      schema,
      refresh: load,
      getFieldMeta,
      getFieldType,
      copyFieldsBySource: copyBySource,
      copyFieldsByDest: copyByDest,
    };
  }, [schema, loading, error, core, load]);

  return <SchemaContext.Provider value={value}>{children}</SchemaContext.Provider>;
}

export function useSchema(): SchemaContextValue {
  const ctx = useContext(SchemaContext);
  if (!ctx) {
    throw new Error("useSchema must be used inside <SchemaProvider>");
  }
  return ctx;
}
