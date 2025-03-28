import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
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
  toTenantAggregatorArray,
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
  eserviceTemplateRefInReadmodelCatalog,
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
  tenantDeclaredAttributeInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  tenantVerifiedAttributeInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(
  readModelDB: ReturnType<typeof drizzle>
) {
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
          templateRef: eserviceTemplateRefInReadmodelCatalog,
          templateVersionRef:
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
        })
        .from(eserviceInReadmodelCatalog)
        .leftJoin(
          // 1
          eserviceDescriptorInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceDescriptorInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          // 2
          eserviceDescriptorInterfaceInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorInterfaceInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 3
          eserviceDescriptorDocumentInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorDocumentInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 4
          eserviceDescriptorAttributeInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorAttributeInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 5
          eserviceDescriptorRejectionReasonInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorRejectionReasonInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 6
          eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.id,
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog.descriptorId
          )
        )
        .leftJoin(
          // 7
          eserviceRiskAnalysisInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceRiskAnalysisInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          // 8
          eserviceRiskAnalysisAnswerInReadmodelCatalog,
          eq(
            eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId,
            eserviceRiskAnalysisAnswerInReadmodelCatalog.riskAnalysisFormId
          )
        )
        .leftJoin(
          // 9
          eserviceTemplateRefInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceTemplateRefInReadmodelCatalog.eserviceId
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
          // 1
          eserviceTemplateVersionInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .leftJoin(
          // 2
          eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionInterfaceInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          // 3
          eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionDocumentInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          // 4
          eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionAttributeInReadmodelEserviceTemplate.versionId
          )
        )
        .leftJoin(
          // 5
          eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.eserviceTemplateId
          )
        )
        .leftJoin(
          // 6
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
      const queryResult = await readModelDB
        .select({
          tenant: tenantInReadmodelTenant,
          mail: tenantMailInReadmodelTenant,
          certifiedAttribute: tenantCertifiedAttributeInReadmodelTenant,
          declaredAttribute: tenantDeclaredAttributeInReadmodelTenant,
          verifiedAttribute: tenantVerifiedAttributeInReadmodelTenant,
          verifier: tenantVerifiedAttributeVerifierInReadmodelTenant,
          revoker: tenantVerifiedAttributeRevokerInReadmodelTenant,
          feature: tenantFeatureInReadmodelTenant,
        })
        .from(tenantInReadmodelTenant)
        .leftJoin(
          // 1
          tenantMailInReadmodelTenant,
          eq(tenantInReadmodelTenant.id, tenantMailInReadmodelTenant.tenantId)
        )
        .leftJoin(
          // 2
          tenantCertifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantCertifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 3
          tenantDeclaredAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantDeclaredAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 4
          tenantVerifiedAttributeInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantVerifiedAttributeInReadmodelTenant.tenantId
          )
        )
        .leftJoin(
          // 5
          tenantVerifiedAttributeVerifierInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          // 6
          tenantVerifiedAttributeRevokerInReadmodelTenant,
          eq(
            tenantVerifiedAttributeInReadmodelTenant.attributeId,
            tenantVerifiedAttributeRevokerInReadmodelTenant.tenantVerifiedAttributeId
          )
        )
        .leftJoin(
          // 7
          tenantFeatureInReadmodelTenant,
          eq(
            tenantInReadmodelTenant.id,
            tenantFeatureInReadmodelTenant.tenantId
          )
        );

      return aggregateTenantArray(toTenantAggregatorArray(queryResult));
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
          // 1
          purposeRiskAnalysisFormInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeRiskAnalysisFormInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          // 2
          purposeRiskAnalysisAnswerInReadmodelPurpose,
          eq(
            purposeRiskAnalysisFormInReadmodelPurpose.id,
            purposeRiskAnalysisAnswerInReadmodelPurpose.riskAnalysisFormId
          )
        )
        .leftJoin(
          // 3
          purposeVersionInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeVersionInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          // 4
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
          // 1
          agreementStampInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementStampInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          // 2
          agreementAttributeInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementAttributeInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          // 3
          agreementConsumerDocumentInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementConsumerDocumentInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          // 4
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
          // 1
          clientUserInReadmodelClient,
          eq(clientInReadmodelClient.id, clientUserInReadmodelClient.clientId)
        )
        .leftJoin(
          // 2
          clientPurposeInReadmodelClient,
          eq(
            clientInReadmodelClient.id,
            clientPurposeInReadmodelClient.clientId
          )
        )
        .leftJoin(
          // 3
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
      /*
        producer_keychain -> 1 producer_keychain_user
                          -> 2 producer_keychain_eservice
                          -> 3 producer_keychain_key
      */
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
          // 1
          producerKeychainUserInReadmodelProducerKeychain,
          eq(
            producerKeychainInReadmodelProducerKeychain.id,
            producerKeychainUserInReadmodelProducerKeychain.producerKeychainId
          )
        )
        .leftJoin(
          // 2
          producerKeychainEserviceInReadmodelProducerKeychain,
          eq(
            producerKeychainInReadmodelProducerKeychain.id,
            producerKeychainEserviceInReadmodelProducerKeychain.producerKeychainId
          )
        )
        .leftJoin(
          // 3
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
          // 1
          delegationStampInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationStampInReadmodelDelegation.delegationId
          )
        )
        .leftJoin(
          // 2
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
