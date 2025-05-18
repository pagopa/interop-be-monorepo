import { z } from "zod";
import {
  attributeInReadmodelAttribute,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
} from "pagopa-interop-readmodel-models";
import { AttributeDeletingSchema } from "../attribute/attribute.js";
import { EserviceDeletingSchema } from "../catalog/eservice.js";

import { EserviceRiskAnalysisDeletingSchema } from "../catalog/eserviceRiskAnalysis.js";
import { extractProp } from "../../db/dbModelMetadataExtractor.js";

const DeletingTableMeta = {
  attribute_deleting_table: {
    schema: AttributeDeletingSchema,
    readModel: attributeInReadmodelAttribute,
  },
  catalog_deleting_table: {
    schema: EserviceDeletingSchema,
    readModel: eserviceInReadmodelCatalog,
  },
  catalog_risk_deleting_table: {
    schema: EserviceRiskAnalysisDeletingSchema,
    readModel: eserviceRiskAnalysisInReadmodelCatalog,
  },
  agreement_deleting_table: {
    schema: EserviceRiskAnalysisDeletingSchema,
    readModel: eserviceRiskAnalysisInReadmodelCatalog,
  },
} as const;
export const DeletingDbTableConfig = extractProp(DeletingTableMeta, "schema");
export type DeletingDbTableConfig = typeof DeletingDbTableConfig;

export const DeletingDbTableReadModel = extractProp(
  DeletingTableMeta,
  "readModel"
);
export type DeletingDbTableReadModel = typeof DeletingDbTableReadModel;

export type DeletingDbTable = keyof DeletingDbTableConfig;
export const DeletingDbTable = Object.fromEntries(
  Object.keys(DeletingDbTableConfig).map((k) => [k, k])
) as { [K in DeletingDbTable]: K };

export type DeletingDbTableConfigMap = {
  [K in keyof DeletingDbTableConfig]: {
    name: K;
    columns: ReadonlyArray<keyof z.infer<DeletingDbTableConfig[K]>>;
  };
}[keyof DeletingDbTableConfig];
