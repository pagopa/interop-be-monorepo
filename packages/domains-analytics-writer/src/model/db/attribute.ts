import { attributeInReadmodelAttribute } from "pagopa-interop-readmodel-models";
import { AttributeSchema } from "../attribute/attribute.js";
import { extractProp } from "../../db/dbModelMetadataExtractor.js";

const AttributeTableMeta = {
  attribute: {
    schema: AttributeSchema,
    readModel: attributeInReadmodelAttribute,
  },
} as const;
export const AttributeDbTableConfig = extractProp(AttributeTableMeta, "schema");
export type AttributeDbTableConfig = typeof AttributeDbTableConfig;
export const AttributeDbTableReadModel = extractProp(
  AttributeTableMeta,
  "readModel"
);
export type AttributeDbTableReadModel = typeof AttributeDbTableReadModel;

export type AttributeDbTable = keyof typeof AttributeDbTableConfig;
export const AttributeDbTable = Object.fromEntries(
  Object.keys(AttributeDbTableConfig).map((k) => [k, k])
) as { [K in AttributeDbTable]: K };
