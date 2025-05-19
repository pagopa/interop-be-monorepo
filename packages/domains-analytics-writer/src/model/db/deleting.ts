import { z } from "zod";
import {
  agreementInReadmodelAgreement,
  attributeInReadmodelAttribute,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
} from "pagopa-interop-readmodel-models";

import { AttributeDeletingSchema } from "../attribute/attribute.js";
import { EserviceDeletingSchema } from "../catalog/eservice.js";
import { EserviceRiskAnalysisDeletingSchema } from "../catalog/eserviceRiskAnalysis.js";
import { AgreementDeletingSchema } from "../agreement/agreement.js";

export const DeletingDbTableConfig = {
  attribute_deleting_table: AttributeDeletingSchema,
  catalog_deleting_table: EserviceDeletingSchema,
  catalog_risk_deleting_table: EserviceRiskAnalysisDeletingSchema,
  agreement_deleting_table: AgreementDeletingSchema,
} as const;
export type DeletingDbTableConfig = typeof DeletingDbTableConfig;

export const DeletingDbTableReadModel = {
  attribute_deleting_table: attributeInReadmodelAttribute,
  catalog_deleting_table: eserviceInReadmodelCatalog,
  catalog_risk_deleting_table: eserviceRiskAnalysisInReadmodelCatalog,
  agreement_deleting_table: agreementInReadmodelAgreement,
} as const;
export type DeletingDbTableReadModel = typeof DeletingDbTableReadModel;

export type DeletingDbTable = keyof DeletingDbTableConfig;

export const DeletingDbTable = Object.fromEntries(
  Object.keys(DeletingDbTableConfig).map((k) => [k, k]),
) as { [K in DeletingDbTable]: K };

export type DeletingDbTableConfigMap = {
  [K in keyof DeletingDbTableConfig]: {
    name: K;
    columns: ReadonlyArray<keyof z.infer<DeletingDbTableConfig[K]>>;
  };
}[keyof DeletingDbTableConfig];
