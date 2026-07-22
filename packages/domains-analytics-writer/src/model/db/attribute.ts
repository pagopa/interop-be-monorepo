import { AttributeSchema } from "pagopa-interop-kpi-models";

export const AttributeDbTableConfig = {
  attribute: AttributeSchema,
} as const;
export type AttributeDbTableConfig = typeof AttributeDbTableConfig;

export type AttributeDbTable = keyof typeof AttributeDbTableConfig;

export const AttributeDbTable = Object.fromEntries(
  Object.keys(AttributeDbTableConfig).map((k) => [k, k])
) as { [K in AttributeDbTable]: K };
