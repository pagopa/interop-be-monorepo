/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  AttributeId,
  EService,
  Tenant,
  Attribute,
  descriptorState,
} from "pagopa-interop-models";
import { and, eq, inArray } from "drizzle-orm";
import {
  attributeInReadmodelAttribute,
  DrizzleTransactionType,
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorInterfaceInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantDeclaredAttributeInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  tenantVerifiedAttributeInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
  DrizzleReturnType,
  TenantCertifiedAttributeSQL,
  TenantDeclaredAttributeSQL,
  TenantFeatureSQL,
  TenantMailSQL,
  TenantSQL,
  TenantVerifiedAttributeRevokerSQL,
  TenantVerifiedAttributeSQL,
  TenantVerifiedAttributeVerifierSQL,
} from "pagopa-interop-readmodel-models";
import {
  aggregateEserviceArray,
  TenantReadModelService,
  toEServiceAggregatorArray,
  aggregateTenantArray,
  AttributeReadModelService,
} from "pagopa-interop-readmodel";
import { ascLower } from "pagopa-interop-commons";

export function readModelServiceBuilderSQL(
  readModelDB: DrizzleReturnType,
  attributeReadModelService: AttributeReadModelService,
  tenantReadModelService: TenantReadModelService
) {
  return {
    /**
     * Fetches all active e-services from the database, validates them and returns them.
     * The e-services is considered active if it has at least one descriptor with state "Published" or "Suspended".
     *
     * @returns The array of e-services
     */
    async getActiveEServices(): Promise<EService[]> {
      const queryResult = await readModelDB
        .select({
          eservice: eserviceInReadmodelCatalog,
          descriptor: eserviceDescriptorInReadmodelCatalog,
          interface: eserviceDescriptorInterfaceInReadmodelCatalog,
          document: eserviceDescriptorDocumentInReadmodelCatalog,
          attribute: eserviceDescriptorAttributeInReadmodelCatalog,
          rejection: eserviceDescriptorRejectionReasonInReadmodelCatalog,
          riskAnalysis: eserviceRiskAnalysisInReadmodelCatalog,
          riskAnalysisAnswer: eserviceRiskAnalysisAnswerInReadmodelCatalog,
          templateVersionRef:
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
        })
        .from(eserviceInReadmodelCatalog)
        .where(
          inArray(eserviceDescriptorInReadmodelCatalog.state, [
            descriptorState.published,
            descriptorState.suspended,
          ])
        )
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
        .leftJoin(
          eserviceRiskAnalysisInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceRiskAnalysisInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          eserviceRiskAnalysisAnswerInReadmodelCatalog,
          and(
            eq(
              eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
              eserviceRiskAnalysisAnswerInReadmodelCatalog.riskAnalysisFormId
            ),
            eq(
              eserviceRiskAnalysisInReadmodelCatalog.eserviceId,
              eserviceRiskAnalysisAnswerInReadmodelCatalog.eserviceId
            )
          )
        );

      const eservicesWithMetadata = aggregateEserviceArray(
        toEServiceAggregatorArray(queryResult)
      );
      return eservicesWithMetadata.map(
        (eserviceWithMetadata) => eserviceWithMetadata.data
      );
    },

    /**
     * Fetches all the attributes from the database filtering by the passed attribute ids;
     *
     * @param attributeIds - The array of attributes ids
     * @returns The array of attributes
     * */
    async getAttributes(attributeIds: AttributeId[]): Promise<Attribute[]> {
      const attributesWithMetadata =
        await attributeReadModelService.getAttributesByFilter(
          inArray(attributeInReadmodelAttribute.id, attributeIds)
        );

      return attributesWithMetadata.map(
        (attributeWithMetadata) => attributeWithMetadata.data
      );
    },

    /**
     * Fetches all the tenants from the database filtering by the passed tenant ids;
     *
     * @param tenantIds - The array of tenant ids to retrieve
     * @returns The array of tenants
     * */
    async getTenantsByIds(tenantIds: string[]): Promise<Tenant[]> {
      return await readModelDB.transaction(async (tx) => {
        const tenantsWithMetadata =
          await tenantReadModelService.getTenantsByIds(tenantIds, tx);

        return tenantsWithMetadata.map(
          (tenantWithMetadata) => tenantWithMetadata.data
        );
      });
    },

    /**
     * Fetches all tenants from the database
     *
     * @returns The array of all tenants
     */
    async getAllTenants(): Promise<Tenant[]> {
      return await readModelDB.transaction(async (tx) => {
        const [
          tenantsSQL,
          mailsSQL,
          certifiedAttributesSQL,
          declaredAttributesSQL,
          verifiedAttributesSQL,
          verifiedAttributeVerifiersSQL,
          verifiedAttributeRevokersSQL,
          featuresSQL,
        ] = await Promise.all([
          readAllTenantsSQL(tx),
          readAllTenantMailsSQL(tx),
          readAllTenantCertifiedAttributesSQL(tx),
          readAllTenantDeclaredAttributesSQL(tx),
          readAllTenantVerifiedAttributesSQL(tx),
          readAllTenantVerifiedAttributeVerifiersSQL(tx),
          readAllTenantVerifiedAttributeRevokersSQL(tx),
          readAllTenantFeaturesSQL(tx),
        ]);

        const tenantsWithMetadata = aggregateTenantArray({
          tenantsSQL,
          mailsSQL,
          certifiedAttributesSQL,
          declaredAttributesSQL,
          verifiedAttributesSQL,
          verifiedAttributeVerifiersSQL,
          verifiedAttributeRevokersSQL,
          featuresSQL,
        });

        return tenantsWithMetadata.map((tenant) => tenant.data);
      });
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;

const readAllTenantsSQL = async (
  tx: DrizzleTransactionType
): Promise<TenantSQL[]> =>
  await tx
    .select()
    .from(tenantInReadmodelTenant)
    .orderBy(ascLower(tenantInReadmodelTenant.name));

const readAllTenantMailsSQL = async (
  tx: DrizzleTransactionType
): Promise<TenantMailSQL[]> =>
  await tx.select().from(tenantMailInReadmodelTenant);

const readAllTenantCertifiedAttributesSQL = async (
  tx: DrizzleTransactionType
): Promise<TenantCertifiedAttributeSQL[]> =>
  await tx.select().from(tenantCertifiedAttributeInReadmodelTenant);

const readAllTenantDeclaredAttributesSQL = async (
  tx: DrizzleTransactionType
): Promise<TenantDeclaredAttributeSQL[]> =>
  await tx.select().from(tenantDeclaredAttributeInReadmodelTenant);

const readAllTenantVerifiedAttributesSQL = async (
  tx: DrizzleTransactionType
): Promise<TenantVerifiedAttributeSQL[]> =>
  await tx.select().from(tenantVerifiedAttributeInReadmodelTenant);

const readAllTenantVerifiedAttributeVerifiersSQL = async (
  tx: DrizzleTransactionType
): Promise<TenantVerifiedAttributeVerifierSQL[]> =>
  await tx.select().from(tenantVerifiedAttributeVerifierInReadmodelTenant);

const readAllTenantVerifiedAttributeRevokersSQL = async (
  tx: DrizzleTransactionType
): Promise<TenantVerifiedAttributeRevokerSQL[]> =>
  await tx.select().from(tenantVerifiedAttributeRevokerInReadmodelTenant);

const readAllTenantFeaturesSQL = async (
  tx: DrizzleTransactionType
): Promise<TenantFeatureSQL[]> =>
  await tx.select().from(tenantFeatureInReadmodelTenant);
