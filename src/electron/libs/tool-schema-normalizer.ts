export type ToolSchemaNormalizationIssue = {
  path: string;
  actualType: string;
};

type ToolSchemaIssueReporter = (issue: ToolSchemaNormalizationIssue) => void;

const SCHEMA_MAP_KEYWORDS = [
  "$defs",
  "definitions",
  "dependencies",
  "dependentSchemas",
  "patternProperties",
  "properties",
] as const;

const SCHEMA_ARRAY_KEYWORDS = ["allOf", "anyOf", "oneOf", "prefixItems"] as const;

const SCHEMA_VALUE_KEYWORDS = [
  "additionalItems",
  "additionalProperties",
  "contains",
  "contentSchema",
  "else",
  "if",
  "items",
  "not",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
] as const;

export function normalizeToolJsonSchema(
  schema: unknown,
  reportIssue?: ToolSchemaIssueReporter,
): Record<string, unknown> {
  const normalized = isRecord(schema)
    ? normalizeSchemaNode(schema, "$", reportIssue)
    : { type: "object", properties: {} };

  if (normalized.type !== "object") {
    normalized.type = "object";
  }
  if (!isRecord(normalized.properties)) {
    normalized.properties = {};
  }

  return normalized;
}

export function logToolSchemaNormalizationIssue(
  toolName: string,
  issue: ToolSchemaNormalizationIssue,
): void {
  console.warn("[tool-schema] normalized invalid required keyword", {
    toolName,
    path: issue.path,
    actualType: issue.actualType,
  });
}

function normalizeSchemaNode(
  schema: Record<string, unknown>,
  path: string,
  reportIssue?: ToolSchemaIssueReporter,
): Record<string, unknown> {
  const normalized = { ...schema };

  if ("required" in normalized) {
    const required = normalized.required;
    if (!Array.isArray(required)) {
      reportIssue?.({ path: `${path}.required`, actualType: valueType(required) });
      delete normalized.required;
    } else {
      const stringItems = required.filter((item): item is string => typeof item === "string");
      if (stringItems.length !== required.length) {
        reportIssue?.({ path: `${path}.required`, actualType: "array-with-non-string-items" });
      }
      normalized.required = stringItems;
    }
  }

  for (const keyword of SCHEMA_MAP_KEYWORDS) {
    const children = normalized[keyword];
    if (!isRecord(children)) {
      continue;
    }
    normalized[keyword] = Object.fromEntries(
      Object.entries(children).map(([name, child]) => [
        name,
        isRecord(child)
          ? normalizeSchemaNode(child, `${path}.${keyword}.${name}`, reportIssue)
          : child,
      ]),
    );
  }

  for (const keyword of SCHEMA_ARRAY_KEYWORDS) {
    const children = normalized[keyword];
    if (!Array.isArray(children)) {
      continue;
    }
    normalized[keyword] = children.map((child, index) => (
      isRecord(child)
        ? normalizeSchemaNode(child, `${path}.${keyword}[${index}]`, reportIssue)
        : child
    ));
  }

  for (const keyword of SCHEMA_VALUE_KEYWORDS) {
    const child = normalized[keyword];
    if (isRecord(child)) {
      normalized[keyword] = normalizeSchemaNode(child, `${path}.${keyword}`, reportIssue);
      continue;
    }
    if (keyword === "items" && Array.isArray(child)) {
      normalized.items = child.map((item, index) => (
        isRecord(item)
          ? normalizeSchemaNode(item, `${path}.items[${index}]`, reportIssue)
          : item
      ));
    }
  }

  return normalized;
}

function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
