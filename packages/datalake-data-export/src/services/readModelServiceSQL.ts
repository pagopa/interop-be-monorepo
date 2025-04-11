/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  agreementState,
  descriptorState,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  agreementInReadmodelAgreement,
  DrizzleReturnType,
  eserviceDescriptorInReadmodelCatalog,
  purposeInReadmodelPurpose,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  purposeRiskAnalysisFormInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import {
  aggregatePurposeArray,
  AgreementReadModelService,
  CatalogReadModelService,
  TenantReadModelService,
  toPurposeAggregatorArray,
} from "pagopa-interop-readmodel";
import { isNotNull, eq, ne, and } from "drizzle-orm";
import {
  ExportedAgreement,
  ExportedEService,
  ExportedPurpose,
  ExportedTenant,
} from "../config/models/models.js";

export function readModelServiceBuilderSQL({
  readModelDB,
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  agreementReadModelServiceSQL: AgreementReadModelService;
  catalogReadModelServiceSQL: CatalogReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
}) {
  return {
    async getTenants(): Promise<ExportedTenant[]> {
      return (
        await tenantReadModelServiceSQL.getTenantsByFilter(
          isNotNull(tenantInReadmodelTenant.selfcareId)
        )
      ).map((tenant) => ExportedTenant.parse(tenant.data));
    },
    async getEServices(): Promise<ExportedEService[]> {
      return (
        await catalogReadModelServiceSQL.getEServicesByFilter(
          and(
            ne(
              eserviceDescriptorInReadmodelCatalog.state,
              descriptorState.draft
            ),
            ne(
              eserviceDescriptorInReadmodelCatalog.state,
              descriptorState.waitingForApproval
            )
          )
        )
      ).map((eservice) => ExportedEService.parse(eservice.data));
    },
    async getAgreements(): Promise<ExportedAgreement[]> {
      return (
        await agreementReadModelServiceSQL.getAgreementsByFilter(
          ne(agreementInReadmodelAgreement.state, agreementState.draft)
        )
      ).map((agreement) => ExportedAgreement.parse(agreement.data));
    },
    async getPurposes(): Promise<ExportedPurpose[]> {
      const subquery = readModelDB
        .selectDistinct({
          purposeId: purposeInReadmodelPurpose.id,
        })
        .from(purposeInReadmodelPurpose)
        .innerJoin(
          purposeVersionInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.purposeId,
            purposeInReadmodelPurpose.id
          )
        )
        .where(
          and(
            ne(
              purposeVersionInReadmodelPurpose.state,
              purposeVersionState.draft
            ),
            ne(
              purposeVersionInReadmodelPurpose.state,
              purposeVersionState.waitingForApproval
            )
          )
        )
        .as("subquery");

      const queryResult = await readModelDB
        .select({
          purpose: purposeInReadmodelPurpose,
          purposeRiskAnalysisForm: purposeRiskAnalysisFormInReadmodelPurpose,
          purposeRiskAnalysisAnswer:
            purposeRiskAnalysisAnswerInReadmodelPurpose,
          purposeVersion: purposeVersionInReadmodelPurpose,
          purposeVersionDocument: purposeVersionDocumentInReadmodelPurpose,
        })
        .from(purposeInReadmodelPurpose)
        .innerJoin(
          subquery,
          eq(purposeInReadmodelPurpose.id, subquery.purposeId)
        )
        .leftJoin(
          purposeRiskAnalysisFormInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeRiskAnalysisFormInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          purposeRiskAnalysisAnswerInReadmodelPurpose,
          eq(
            purposeRiskAnalysisFormInReadmodelPurpose.id,
            purposeRiskAnalysisAnswerInReadmodelPurpose.riskAnalysisFormId
          )
        )
        .leftJoin(
          purposeVersionInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeVersionInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          purposeVersionDocumentInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionDocumentInReadmodelPurpose.purposeVersionId
          )
        );

      return aggregatePurposeArray(toPurposeAggregatorArray(queryResult)).map(
        (purpose) => ExportedPurpose.parse(purpose.data)
      );
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
