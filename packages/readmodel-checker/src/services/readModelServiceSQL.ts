import { and, eq } from "drizzle-orm";
import { ascLower } from "pagopa-interop-commons";
import {
  Agreement,
  Attribute,
  Client,
  ClientJWKKey,
  Delegation,
  EService,
  EServiceTemplate,
  ProducerJWKKey,
  ProducerKeychain,
  Purpose,
  Tenant,
  WithMetadata,
} from "pagopa-interop-models";
import {
  aggregateAttributeArray,
  aggregateEserviceArray,
  toEServiceAggregatorArray,
  aggregateTenantArray,
  toPurposeAggregatorArray,
  aggregatePurposeArray,
  aggregateAgreementArray,
  toAgreementAggregatorArray,
  aggregateClientArray,
  toClientAggregatorArray,
  aggregateClientJWKKeyArray,
  aggregateProducerKeychainArray,
  toProducerKeychainAggregatorArray,
  aggregateProducerJWKKeyArray,
  aggregateDelegationsArray,
  toDelegationAggregatorArray,
  aggregateEServiceTemplateArray,
  toEServiceTemplateAggregatorArray,
} from "pagopa-interop-readmodel";
import {
  agreementAttributeInReadmodelAgreement,
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  attributeInReadmodelAttribute,
  clientInReadmodelClient,
  clientJwkKeyInReadmodelClientJwkKey,
  clientKeyInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientUserInReadmodelClient,
  delegationContractDocumentInReadmodelDelegation,
  delegationInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
  DrizzleReturnType,
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
  eserviceTemplateInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
  eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
  eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
  eserviceTemplateVersionInReadmodelEserviceTemplate,
  eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
  producerJwkKeyInReadmodelProducerJwkKey,
  producerKeychainEserviceInReadmodelProducerKeychain,
  producerKeychainInReadmodelProducerKeychain,
  producerKeychainKeyInReadmodelProducerKeychain,
  producerKeychainUserInReadmodelProducerKeychain,
  purposeInReadmodelPurpose,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  purposeRiskAnalysisFormInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  tenantCertifiedAttributeInReadmodelTenant,
  TenantCertifiedAttributeSQL,
  tenantDeclaredAttributeInReadmodelTenant,
  TenantDeclaredAttributeSQL,
  tenantFeatureInReadmodelTenant,
  TenantFeatureSQL,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  TenantMailSQL,
  TenantSQL,
  tenantVerifiedAttributeInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  TenantVerifiedAttributeRevokerSQL,
  TenantVerifiedAttributeSQL,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
  TenantVerifiedAttributeVerifierSQL,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(readModelDB: DrizzleReturnType) {
  return {
    async getAllAttributes(): Promise<Array<WithMetadata<Attribute>>> {
      const res = await readModelDB
        .select()
        .from(attributeInReadmodelAttribute);

      return aggregateAttributeArray(res);
    },

    async getAllEServices(): Promise<Array<WithMetadata<EService>>> {
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

      return aggregateEserviceArray(toEServiceAggregatorArray(queryResult));
    },

    async getAllEServiceTemplates(): Promise<
      Array<WithMetadata<EServiceTemplate>>
    > {
      const queryResult = await readModelDB
        .select({
          eserviceTemplate: eserviceTemplateInReadmodelEserviceTemplate,
          version: eserviceTemplateVersionInReadmodelEserviceTemplate,
          interface:
            eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
          document: eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
          attribute:
            eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
          riskAnalysis: eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
          riskAnalysisAnswer:
            eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
        })
        .from(eserviceTemplateInReadmodelEserviceTemplate)
        .leftJoin(
          eserviceTemplateVersionInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .leftJoin(
          eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionDocumentInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionAttributeInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .leftJoin(
          eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.riskAnalysisFormId,
            eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate.riskAnalysisFormId
          )
        );

      return aggregateEServiceTemplateArray(
        toEServiceTemplateAggregatorArray(queryResult)
      );
    },

    async getAllTenants(): Promise<Array<WithMetadata<Tenant>>> {
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

        return aggregateTenantArray({
          tenantsSQL,
          mailsSQL,
          certifiedAttributesSQL,
          declaredAttributesSQL,
          verifiedAttributesSQL,
          verifiedAttributeVerifiersSQL,
          verifiedAttributeRevokersSQL,
          featuresSQL,
        });
      });
    },

    async getAllPurposes(): Promise<Array<WithMetadata<Purpose>>> {
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

      return aggregatePurposeArray(toPurposeAggregatorArray(queryResult));
    },

    async getAllAgreements(): Promise<Array<WithMetadata<Agreement>>> {
      const queryResult = await readModelDB
        .select({
          agreement: agreementInReadmodelAgreement,
          stamp: agreementStampInReadmodelAgreement,
          attribute: agreementAttributeInReadmodelAgreement,
          consumerDocument: agreementConsumerDocumentInReadmodelAgreement,
          contract: agreementContractInReadmodelAgreement,
        })
        .from(agreementInReadmodelAgreement)
        .leftJoin(
          agreementStampInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementStampInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementAttributeInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementAttributeInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementConsumerDocumentInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementConsumerDocumentInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementContractInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementContractInReadmodelAgreement.agreementId
          )
        );

      return aggregateAgreementArray(toAgreementAggregatorArray(queryResult));
    },

    async getAllClients(): Promise<Array<WithMetadata<Client>>> {
      const queryResult = await readModelDB
        .select({
          client: clientInReadmodelClient,
          clientUser: clientUserInReadmodelClient,
          clientPurpose: clientPurposeInReadmodelClient,
          clientKey: clientKeyInReadmodelClient,
        })
        .from(clientInReadmodelClient)
        .leftJoin(
          clientUserInReadmodelClient,
          eq(clientInReadmodelClient.id, clientUserInReadmodelClient.clientId)
        )
        .leftJoin(
          clientPurposeInReadmodelClient,
          eq(
            clientInReadmodelClient.id,
            clientPurposeInReadmodelClient.clientId
          )
        )
        .leftJoin(
          clientKeyInReadmodelClient,
          eq(clientInReadmodelClient.id, clientKeyInReadmodelClient.clientId)
        );

      return aggregateClientArray(toClientAggregatorArray(queryResult));
    },

    async getAllClientJWKKeys(): Promise<Array<WithMetadata<ClientJWKKey>>> {
      const queryResult = await readModelDB
        .select()
        .from(clientJwkKeyInReadmodelClientJwkKey);

      return aggregateClientJWKKeyArray(queryResult);
    },

    async getAllProducerKeychains(): Promise<
      Array<WithMetadata<ProducerKeychain>>
    > {
      const queryResult = await readModelDB
        .select({
          producerKeychain: producerKeychainInReadmodelProducerKeychain,
          producerKeychainUser: producerKeychainUserInReadmodelProducerKeychain,
          producerKeychainEService:
            producerKeychainEserviceInReadmodelProducerKeychain,
          producerKeychainKey: producerKeychainKeyInReadmodelProducerKeychain,
        })
        .from(producerKeychainInReadmodelProducerKeychain)
        .leftJoin(
          producerKeychainUserInReadmodelProducerKeychain,
          eq(
            producerKeychainInReadmodelProducerKeychain.id,
            producerKeychainUserInReadmodelProducerKeychain.producerKeychainId
          )
        )
        .leftJoin(
          producerKeychainEserviceInReadmodelProducerKeychain,
          eq(
            producerKeychainInReadmodelProducerKeychain.id,
            producerKeychainEserviceInReadmodelProducerKeychain.producerKeychainId
          )
        )
        .leftJoin(
          producerKeychainKeyInReadmodelProducerKeychain,
          eq(
            producerKeychainInReadmodelProducerKeychain.id,
            producerKeychainKeyInReadmodelProducerKeychain.producerKeychainId
          )
        );

      return aggregateProducerKeychainArray(
        toProducerKeychainAggregatorArray(queryResult)
      );
    },

    async getAllProducerJWKKeys(): Promise<
      Array<WithMetadata<ProducerJWKKey>>
    > {
      const queryResult = await readModelDB
        .select()
        .from(producerJwkKeyInReadmodelProducerJwkKey);

      return aggregateProducerJWKKeyArray(queryResult);
    },

    async getAllDelegations(): Promise<Array<WithMetadata<Delegation>>> {
      const queryResult = await readModelDB
        .select({
          delegation: delegationInReadmodelDelegation,
          delegationStamp: delegationStampInReadmodelDelegation,
          delegationContractDocument:
            delegationContractDocumentInReadmodelDelegation,
        })
        .from(delegationInReadmodelDelegation)
        .leftJoin(
          delegationStampInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationStampInReadmodelDelegation.delegationId
          )
        )
        .leftJoin(
          delegationContractDocumentInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationContractDocumentInReadmodelDelegation.delegationId
          )
        );

      return aggregateDelegationsArray(
        toDelegationAggregatorArray(queryResult)
      );
    },
  };
}

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
