import { attributeInReadmodelAttribute } from "pagopa-interop-readmodel-models";
import { AttributeSchema } from "../attribute/attribute.js";

export const AttributeDbTableConfig = {
  attribute: AttributeSchema,
} as const;
export type AttributeDbTableConfig = typeof AttributeDbTableConfig;

export const AttributeDbTableReadModel = {
  attribute: attributeInReadmodelAttribute,
} as const;
export type AttributeDbTableReadModel = typeof AttributeDbTableReadModel;

export type AttributeDbTable = keyof typeof AttributeDbTableConfig;

export const AttributeDbTable = Object.fromEntries(
  Object.keys(AttributeDbTableConfig).map((k) => [k, k])
) as { [K in AttributeDbTable]: K };
