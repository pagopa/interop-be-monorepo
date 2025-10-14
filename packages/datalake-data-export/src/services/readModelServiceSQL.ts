/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  agreementState,
  delegationState,
  descriptorState,
  eserviceTemplateVersionState,
  purposeVersionState,
} from "pagopa-interop-models";
import {
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  delegationInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
  DrizzleReturnType,
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorInterfaceInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceTemplateInReadmodelEserviceTemplate,
  eserviceTemplateVersionInReadmodelEserviceTemplate,
  eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
  purposeInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  purposeVersionStampInReadmodelPurpose,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import {
  aggregateAgreementArray,
  aggregateDelegationsArray,
  aggregateEserviceArray,
  aggregateEServiceTemplateArray,
  aggregatePurposeArray,
  aggregateTenantArray,
  toAgreementAggregatorArray,
  toDelegationAggregatorArray,
  toEServiceAggregatorArray,
  toEServiceTemplateAggregatorArray,
  toPurposeAggregatorArray,
  toTenantAggregatorArray,
} from "pagopa-interop-readmodel";
import { isNotNull, eq, ne, and, sql } from "drizzle-orm";
import {
  ExportedAgreement,
  ExportedDelegation,
  ExportedEService,
  ExportedEServiceTemplate,
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
        .innerJoin(
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
      const subquery = readModelDB
        .select({
          id: purposeInReadmodelPurpose.id,
        })
        .from(purposeInReadmodelPurpose)
        .innerJoin(
          purposeVersionInReadmodelPurpose,
          and(
            eq(
              purposeInReadmodelPurpose.id,
              purposeVersionInReadmodelPurpose.purposeId
            ),
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
        .groupBy(purposeInReadmodelPurpose.id)
        .as("subquery");

      const queryResult = await readModelDB
        .select({
          purpose: purposeInReadmodelPurpose,
          purposeVersion: purposeVersionInReadmodelPurpose,
          purposeVersionDocument: purposeVersionDocumentInReadmodelPurpose,
          purposeVersionStamp: purposeVersionStampInReadmodelPurpose,
          purposeRiskAnalysisForm: sql<null>`NULL`,
          purposeRiskAnalysisAnswer: sql<null>`NULL`,
        })
        .from(purposeInReadmodelPurpose)
        .innerJoin(subquery, eq(purposeInReadmodelPurpose.id, subquery.id))
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
        .leftJoin(
          purposeVersionStampInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionStampInReadmodelPurpose.purposeVersionId
          )
        );

      return aggregatePurposeArray(toPurposeAggregatorArray(queryResult)).map(
        (purpose) => ExportedPurpose.parse(purpose.data)
      );
    },
    async getDelegations(): Promise<ExportedDelegation[]> {
      const queryResult = await readModelDB
        .select({
          delegation: delegationInReadmodelDelegation,
          delegationStamp: delegationStampInReadmodelDelegation,
          delegationContractDocument: sql<null>`NULL`,
        })
        .from(delegationInReadmodelDelegation)
        .leftJoin(
          delegationStampInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationStampInReadmodelDelegation.delegationId
          )
        )
        .where(
          ne(
            delegationInReadmodelDelegation.state,
            delegationState.waitingForApproval
          )
        );

      return aggregateDelegationsArray(
        toDelegationAggregatorArray(queryResult)
      ).map((delegation) => ExportedDelegation.parse(delegation.data));
    },
    async getEServiceTemplates(): Promise<ExportedEServiceTemplate[]> {
      const queryResult = await readModelDB
        .select({
          eserviceTemplate: eserviceTemplateInReadmodelEserviceTemplate,
          version: eserviceTemplateVersionInReadmodelEserviceTemplate,
          document: sql<null>`NULL`,
          interface:
            eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
          riskAnalysis: sql<null>`NULL`,
          riskAnalysisAnswer: sql<null>`NULL`,
          attribute: sql<null>`NULL`,
        })
        .from(eserviceTemplateInReadmodelEserviceTemplate)
        .innerJoin(
          eserviceTemplateVersionInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .leftJoin(
          eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId,
            eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .where(
          and(
            ne(
              eserviceTemplateVersionInReadmodelEserviceTemplate.state,
              eserviceTemplateVersionState.draft
            )
          )
        );

      return aggregateEServiceTemplateArray(
        toEServiceTemplateAggregatorArray(queryResult)
      ).map((eserviceTemplate) =>
        ExportedEServiceTemplate.parse(eserviceTemplate.data)
      );
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
