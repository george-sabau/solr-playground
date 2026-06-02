export interface SolrResponseHeader {
  status: number;
  QTime: number;
  params?: Record<string, string>;
}

export interface CoreStatusEntry {
  name?: string;
  instanceDir?: string;
  dataDir?: string;
  [key: string]: unknown;
}

export interface CoresStatusResponse {
  responseHeader: SolrResponseHeader;
  initFailures?: Record<string, string>;
  status: Record<string, CoreStatusEntry>;
}

export interface SchemaField {
  name: string;
  type: string;
  indexed?: boolean;
  stored?: boolean;
  docValues?: boolean;
  multiValued?: boolean;
  required?: boolean;
  uninvertible?: boolean;
  default?: unknown;
  [key: string]: unknown;
}

export type SchemaDynamicField = SchemaField;

export interface SchemaCopyField {
  source: string;
  dest: string;
  maxChars?: number;
}

export interface SchemaAnalyzerComponent {
  class?: string;
  name?: string;
  [attr: string]: unknown;
}

export interface SchemaAnalyzer {
  class?: string;
  tokenizer?: SchemaAnalyzerComponent;
  charFilters?: SchemaAnalyzerComponent[];
  filters?: SchemaAnalyzerComponent[];
  [key: string]: unknown;
}

export interface SchemaFieldType {
  name: string;
  class: string;
  positionIncrementGap?: string | number;
  multiValued?: boolean;
  docValues?: boolean;
  indexed?: boolean;
  stored?: boolean;
  analyzer?: SchemaAnalyzer;
  indexAnalyzer?: SchemaAnalyzer;
  queryAnalyzer?: SchemaAnalyzer;
  similarity?: { class?: string; [k: string]: unknown };
  [key: string]: unknown;
}

export interface SchemaFieldsResponse {
  responseHeader: SolrResponseHeader;
  fields: SchemaField[];
}

export interface SchemaDynamicFieldsResponse {
  responseHeader: SolrResponseHeader;
  dynamicFields: SchemaDynamicField[];
}

export interface SchemaFieldTypesResponse {
  responseHeader: SolrResponseHeader;
  fieldTypes: SchemaFieldType[];
}

export interface SchemaCopyFieldsResponse {
  responseHeader: SolrResponseHeader;
  copyFields: SchemaCopyField[];
}

export type SolrPrimitive = string | number | boolean | null;
export type SolrFieldValue = SolrPrimitive | SolrPrimitive[];

export interface SolrDoc {
  id?: string;
  score?: number;
  [field: string]: SolrFieldValue | undefined;
}

export interface SelectResponse {
  responseHeader: SolrResponseHeader;
  response: {
    numFound: number;
    start: number;
    maxScore?: number;
    numFoundExact?: boolean;
    docs: SolrDoc[];
  };
  error?: { msg?: string; code?: number };
}

export interface AnalysisToken {
  text: string;
  raw_bytes?: string;
  type?: string;
  position?: number;
  positionLength?: number;
  start?: number;
  end?: number;
  match?: boolean;
  [key: string]: unknown;
}

/** Stage name + token list (tokens normalized at parse time — Solr may send odd shapes). */
export type AnalysisStage = [string, AnalysisToken[]];

export interface AnalysisFieldDetails {
  index?: AnalysisStage[];
  query?: AnalysisStage[];
}

export interface AnalysisResponse {
  responseHeader: SolrResponseHeader;
  analysis: {
    field_types?: Record<string, AnalysisFieldDetails>;
    field_names?: Record<string, AnalysisFieldDetails>;
  };
}
