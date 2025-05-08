/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  agreementState,
  descriptorState,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  DrizzleReturnType,
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorInterfaceInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  purposeInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import {
  aggregateAgreementArray,
  aggregateEserviceArray,
  aggregatePurposeArray,
  aggregateTenantArray,
  toAgreementAggregatorArray,
  toEServiceAggregatorArray,
  toPurposeAggregatorArray,
  toTenantAggregatorArray,
} from "pagopa-interop-readmodel";
import { isNotNull, eq, ne, and, sql } from "drizzle-orm";
import {
  ExportedAgreement,
  ExportedEService,
  ExportedPurpose,
  ExportedTenant,
} from "../config/models/models.js";

export function readModelServiceBuilderSQL(readModelDB: DrizzleReturnType) {
  return {
    async getTenants(): Promise<ExportedTenant[]> {
      const queryResult = await readModelDB
        .select({
          tenant: tenantInReadmodelTenant,
          mail: sql<null>`NULL`,
          certifiedAttribute: sql<null>`NULL`,
          declaredAttribute: sql<null>`NULL`,
          verifiedAttribute: sql<null>`NULL`,
          verifier: sql<null>`NULL`,
          revoker: sql<null>`NULL`,
          feature: sql<null>`NULL`,
        })
        .from(tenantInReadmodelTenant)
        .where(isNotNull(tenantInReadmodelTenant.selfcareId));

      return aggregateTenantArray(toTenantAggregatorArray(queryResult)).map(
        (tenant) => ExportedTenant.parse(tenant.data)
      );
    },
    async getEServices(): Promise<ExportedEService[]> {
      const queryResult = await readModelDB
        .select({
          eservice: eserviceInReadmodelCatalog,
          descriptor: eserviceDescriptorInReadmodelCatalog,
          interface: eserviceDescriptorInterfaceInReadmodelCatalog,
          document: eserviceDescriptorDocumentInReadmodelCatalog,
          attribute: eserviceDescriptorAttributeInReadmodelCatalog,
          rejection: eserviceDescriptorRejectionReasonInReadmodelCatalog,
          templateVersionRef:
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
          riskAnalysis: sql<null>`NULL`,
          riskAnalysisAnswer: sql<null>`NULL`,
        })
        .from(eserviceInReadmodelCatalog)
        .leftJoin(
          eserviceDescriptorInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceDescriptorInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          eserviceDescriptorInterfaceInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorInterfaceInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          eserviceDescriptorDocumentInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorDocumentInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          eserviceDescriptorAttributeInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorAttributeInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          eserviceDescriptorRejectionReasonInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorRejectionReasonInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog.descriptorId
          )
        )
        .where(
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
        );

      return aggregateEserviceArray(toEServiceAggregatorArray(queryResult)).map(
        (eservice) => ExportedEService.parse(eservice.data)
      );
    },
    async getAgreements(): Promise<ExportedAgreement[]> {
      const queryResult = await readModelDB
        .select({
          agreement: agreementInReadmodelAgreement,
          stamp: agreementStampInReadmodelAgreement,
          attribute: sql<null>`NULL`,
          consumerDocument: sql<null>`NULL`,
          contract: sql<null>`NULL`,
        })
        .from(agreementInReadmodelAgreement)
        .leftJoin(
          agreementStampInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementStampInReadmodelAgreement.agreementId
          )
        )
        .where(ne(agreementInReadmodelAgreement.state, agreementState.draft));

      return aggregateAgreementArray(
        toAgreementAggregatorArray(queryResult)
      ).map((agreement) => ExportedAgreement.parse(agreement.data));
    },
    async getPurposes(): Promise<ExportedPurpose[]> {
      const queryResult = await readModelDB
        .select({
          purpose: purposeInReadmodelPurpose,
          purposeVersion: purposeVersionInReadmodelPurpose,
          purposeVersionDocument: purposeVersionDocumentInReadmodelPurpose,
          purposeRiskAnalysisForm: sql<null>`NULL`,
          purposeRiskAnalysisAnswer: sql<null>`NULL`,
        })
        .from(purposeInReadmodelPurpose)
        .innerJoin(
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
        );

      return aggregatePurposeArray(toPurposeAggregatorArray(queryResult)).map(
        (purpose) => ExportedPurpose.parse(purpose.data)
      );
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
