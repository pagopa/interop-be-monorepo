import { relations } from "drizzle-orm/relations";
import {
  agreementInReadmodelAgreement,
  agreementDocumentInReadmodelAgreement,
  eserviceTemplateInReadmodelEserviceTemplate,
  eserviceTemplateVersionInReadmodelEserviceTemplate,
  eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
  eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
  eserviceInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  delegationInReadmodelDelegation,
  delegationContractDocumentInReadmodelDelegation,
  purposeInReadmodelPurpose,
  purposeRiskAnalysisFormInReadmodelPurpose,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  tenantInReadmodelTenant,
  tenantMailInReadmodelTenant,
  tenantFeatureInReadmodelTenant,
  producerKeychainInReadmodelProducerKeychain,
  producerKeychainUserInReadmodelProducerKeychain,
  producerKeychainEserviceInReadmodelProducerKeychain,
  clientInReadmodelClient,
  clientUserInReadmodelClient,
  clientPurposeInReadmodelClient,
  agreementAttributeInReadmodelAgreement,
  tenantVerifiedAttributeInReadmodelTenant,
  delegationStampInReadmodelDelegation,
  tenantCertifiedAttributeInReadmodelTenant,
  agreementStampInReadmodelAgreement,
  tenantDeclaredAttributeInReadmodelTenant,
  eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
  eserviceDescriptorAttributeInReadmodelCatalog,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
  clientKeyInReadmodelClient,
  eserviceTemplateBindingInReadmodelCatalog,
  producerKeychainKeyInReadmodelProducerKeychain,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
} from "./schema.js";

export const agreementDocumentInReadmodelAgreementRelations = relations(
  agreementDocumentInReadmodelAgreement,
  ({ one }) => ({
    agreementInReadmodelAgreement: one(agreementInReadmodelAgreement, {
      fields: [agreementDocumentInReadmodelAgreement.agreementId],
      references: [agreementInReadmodelAgreement.id],
    }),
  })
);

export const agreementInReadmodelAgreementRelations = relations(
  agreementInReadmodelAgreement,
  ({ many }) => ({
    agreementDocumentInReadmodelAgreements: many(
      agreementDocumentInReadmodelAgreement
    ),
    agreementAttributeInReadmodelAgreements: many(
      agreementAttributeInReadmodelAgreement
    ),
    agreementStampInReadmodelAgreements: many(
      agreementStampInReadmodelAgreement
    ),
  })
);

export const eserviceTemplateVersionInReadmodelEserviceTemplateRelations =
  relations(
    eserviceTemplateVersionInReadmodelEserviceTemplate,
    ({ one, many }) => ({
      eserviceTemplateInReadmodelEserviceTemplate: one(
        eserviceTemplateInReadmodelEserviceTemplate,
        {
          fields: [
            eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId,
          ],
          references: [eserviceTemplateInReadmodelEserviceTemplate.id],
        }
      ),
      eserviceTemplateVersionDocumentInReadmodelEserviceTemplates: many(
        eserviceTemplateVersionDocumentInReadmodelEserviceTemplate
      ),
      eserviceTemplateVersionAttributeInReadmodelEserviceTemplates: many(
        eserviceTemplateVersionAttributeInReadmodelEserviceTemplate
      ),
    })
  );

export const eserviceTemplateInReadmodelEserviceTemplateRelations = relations(
  eserviceTemplateInReadmodelEserviceTemplate,
  ({ many }) => ({
    eserviceTemplateVersionInReadmodelEserviceTemplates: many(
      eserviceTemplateVersionInReadmodelEserviceTemplate
    ),
    eserviceTemplateVersionDocumentInReadmodelEserviceTemplates: many(
      eserviceTemplateVersionDocumentInReadmodelEserviceTemplate
    ),
    eserviceTemplateRiskAnalysisInReadmodelEserviceTemplates: many(
      eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate
    ),
    eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplates: many(
      eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate
    ),
    eserviceTemplateVersionAttributeInReadmodelEserviceTemplates: many(
      eserviceTemplateVersionAttributeInReadmodelEserviceTemplate
    ),
  })
);

export const eserviceTemplateVersionDocumentInReadmodelEserviceTemplateRelations =
  relations(
    eserviceTemplateVersionDocumentInReadmodelEserviceTemplate,
    ({ one }) => ({
      eserviceTemplateInReadmodelEserviceTemplate: one(
        eserviceTemplateInReadmodelEserviceTemplate,
        {
          fields: [
            eserviceTemplateVersionDocumentInReadmodelEserviceTemplate.eserviceTemplateId,
          ],
          references: [eserviceTemplateInReadmodelEserviceTemplate.id],
        }
      ),
      eserviceTemplateVersionInReadmodelEserviceTemplate: one(
        eserviceTemplateVersionInReadmodelEserviceTemplate,
        {
          fields: [
            eserviceTemplateVersionDocumentInReadmodelEserviceTemplate.eserviceTemplateVersionId,
          ],
          references: [eserviceTemplateVersionInReadmodelEserviceTemplate.id],
        }
      ),
    })
  );

export const eserviceTemplateRiskAnalysisInReadmodelEserviceTemplateRelations =
  relations(
    eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
    ({ one, many }) => ({
      eserviceTemplateInReadmodelEserviceTemplate: one(
        eserviceTemplateInReadmodelEserviceTemplate,
        {
          fields: [
            eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.eserviceTemplateId,
          ],
          references: [eserviceTemplateInReadmodelEserviceTemplate.id],
        }
      ),
      eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplates: many(
        eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate
      ),
    })
  );

export const eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplateRelations =
  relations(
    eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate,
    ({ one }) => ({
      eserviceTemplateInReadmodelEserviceTemplate: one(
        eserviceTemplateInReadmodelEserviceTemplate,
        {
          fields: [
            eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate.eserviceTemplateId,
          ],
          references: [eserviceTemplateInReadmodelEserviceTemplate.id],
        }
      ),
      eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate: one(
        eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate,
        {
          fields: [
            eserviceTemplateRiskAnalysisAnswerInReadmodelEserviceTemplate.riskAnalysisFormId,
          ],
          references: [
            eserviceTemplateRiskAnalysisInReadmodelEserviceTemplate.riskAnalysisFormId,
          ],
        }
      ),
    })
  );

export const eserviceDescriptorInReadmodelCatalogRelations = relations(
  eserviceDescriptorInReadmodelCatalog,
  ({ one, many }) => ({
    eserviceInReadmodelCatalog: one(eserviceInReadmodelCatalog, {
      fields: [eserviceDescriptorInReadmodelCatalog.eserviceId],
      references: [eserviceInReadmodelCatalog.id],
    }),
    eserviceDescriptorRejectionReasonInReadmodelCatalogs: many(
      eserviceDescriptorRejectionReasonInReadmodelCatalog
    ),
    eserviceDescriptorDocumentInReadmodelCatalogs: many(
      eserviceDescriptorDocumentInReadmodelCatalog
    ),
    eserviceDescriptorAttributeInReadmodelCatalogs: many(
      eserviceDescriptorAttributeInReadmodelCatalog
    ),
  })
);

export const eserviceInReadmodelCatalogRelations = relations(
  eserviceInReadmodelCatalog,
  ({ many }) => ({
    eserviceDescriptorInReadmodelCatalogs: many(
      eserviceDescriptorInReadmodelCatalog
    ),
    eserviceDescriptorRejectionReasonInReadmodelCatalogs: many(
      eserviceDescriptorRejectionReasonInReadmodelCatalog
    ),
    eserviceDescriptorDocumentInReadmodelCatalogs: many(
      eserviceDescriptorDocumentInReadmodelCatalog
    ),
    eserviceRiskAnalysisInReadmodelCatalogs: many(
      eserviceRiskAnalysisInReadmodelCatalog
    ),
    eserviceRiskAnalysisAnswerInReadmodelCatalogs: many(
      eserviceRiskAnalysisAnswerInReadmodelCatalog
    ),
    eserviceDescriptorAttributeInReadmodelCatalogs: many(
      eserviceDescriptorAttributeInReadmodelCatalog
    ),
    eserviceTemplateBindingInReadmodelCatalogs: many(
      eserviceTemplateBindingInReadmodelCatalog
    ),
  })
);

export const eserviceDescriptorRejectionReasonInReadmodelCatalogRelations =
  relations(eserviceDescriptorRejectionReasonInReadmodelCatalog, ({ one }) => ({
    eserviceInReadmodelCatalog: one(eserviceInReadmodelCatalog, {
      fields: [eserviceDescriptorRejectionReasonInReadmodelCatalog.eserviceId],
      references: [eserviceInReadmodelCatalog.id],
    }),
    eserviceDescriptorInReadmodelCatalog: one(
      eserviceDescriptorInReadmodelCatalog,
      {
        fields: [
          eserviceDescriptorRejectionReasonInReadmodelCatalog.descriptorId,
        ],
        references: [eserviceDescriptorInReadmodelCatalog.id],
      }
    ),
  }));

export const eserviceDescriptorDocumentInReadmodelCatalogRelations = relations(
  eserviceDescriptorDocumentInReadmodelCatalog,
  ({ one }) => ({
    eserviceInReadmodelCatalog: one(eserviceInReadmodelCatalog, {
      fields: [eserviceDescriptorDocumentInReadmodelCatalog.eserviceId],
      references: [eserviceInReadmodelCatalog.id],
    }),
    eserviceDescriptorInReadmodelCatalog: one(
      eserviceDescriptorInReadmodelCatalog,
      {
        fields: [eserviceDescriptorDocumentInReadmodelCatalog.descriptorId],
        references: [eserviceDescriptorInReadmodelCatalog.id],
      }
    ),
  })
);

export const eserviceRiskAnalysisInReadmodelCatalogRelations = relations(
  eserviceRiskAnalysisInReadmodelCatalog,
  ({ one, many }) => ({
    eserviceInReadmodelCatalog: one(eserviceInReadmodelCatalog, {
      fields: [eserviceRiskAnalysisInReadmodelCatalog.eserviceId],
      references: [eserviceInReadmodelCatalog.id],
    }),
    eserviceRiskAnalysisAnswerInReadmodelCatalogs: many(
      eserviceRiskAnalysisAnswerInReadmodelCatalog
    ),
  })
);

export const eserviceRiskAnalysisAnswerInReadmodelCatalogRelations = relations(
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  ({ one }) => ({
    eserviceInReadmodelCatalog: one(eserviceInReadmodelCatalog, {
      fields: [eserviceRiskAnalysisAnswerInReadmodelCatalog.eserviceId],
      references: [eserviceInReadmodelCatalog.id],
    }),
    eserviceRiskAnalysisInReadmodelCatalog: one(
      eserviceRiskAnalysisInReadmodelCatalog,
      {
        fields: [
          eserviceRiskAnalysisAnswerInReadmodelCatalog.riskAnalysisFormId,
        ],
        references: [eserviceRiskAnalysisInReadmodelCatalog.riskAnalysisFormId],
      }
    ),
  })
);

export const delegationContractDocumentInReadmodelDelegationRelations =
  relations(delegationContractDocumentInReadmodelDelegation, ({ one }) => ({
    delegationInReadmodelDelegation: one(delegationInReadmodelDelegation, {
      fields: [delegationContractDocumentInReadmodelDelegation.delegationId],
      references: [delegationInReadmodelDelegation.id],
    }),
  }));

export const delegationInReadmodelDelegationRelations = relations(
  delegationInReadmodelDelegation,
  ({ many }) => ({
    delegationContractDocumentInReadmodelDelegations: many(
      delegationContractDocumentInReadmodelDelegation
    ),
    delegationStampInReadmodelDelegations: many(
      delegationStampInReadmodelDelegation
    ),
  })
);

export const purposeRiskAnalysisFormInReadmodelPurposeRelations = relations(
  purposeRiskAnalysisFormInReadmodelPurpose,
  ({ one, many }) => ({
    purposeInReadmodelPurpose: one(purposeInReadmodelPurpose, {
      fields: [purposeRiskAnalysisFormInReadmodelPurpose.purposeId],
      references: [purposeInReadmodelPurpose.id],
    }),
    purposeRiskAnalysisAnswerInReadmodelPurposes: many(
      purposeRiskAnalysisAnswerInReadmodelPurpose
    ),
  })
);

export const purposeInReadmodelPurposeRelations = relations(
  purposeInReadmodelPurpose,
  ({ many }) => ({
    purposeRiskAnalysisFormInReadmodelPurposes: many(
      purposeRiskAnalysisFormInReadmodelPurpose
    ),
    purposeRiskAnalysisAnswerInReadmodelPurposes: many(
      purposeRiskAnalysisAnswerInReadmodelPurpose
    ),
    purposeVersionInReadmodelPurposes: many(purposeVersionInReadmodelPurpose),
    purposeVersionDocumentInReadmodelPurposes: many(
      purposeVersionDocumentInReadmodelPurpose
    ),
  })
);

export const purposeRiskAnalysisAnswerInReadmodelPurposeRelations = relations(
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  ({ one }) => ({
    purposeInReadmodelPurpose: one(purposeInReadmodelPurpose, {
      fields: [purposeRiskAnalysisAnswerInReadmodelPurpose.purposeId],
      references: [purposeInReadmodelPurpose.id],
    }),
    purposeRiskAnalysisFormInReadmodelPurpose: one(
      purposeRiskAnalysisFormInReadmodelPurpose,
      {
        fields: [
          purposeRiskAnalysisAnswerInReadmodelPurpose.riskAnalysisFormId,
        ],
        references: [purposeRiskAnalysisFormInReadmodelPurpose.id],
      }
    ),
  })
);

export const purposeVersionInReadmodelPurposeRelations = relations(
  purposeVersionInReadmodelPurpose,
  ({ one, many }) => ({
    purposeInReadmodelPurpose: one(purposeInReadmodelPurpose, {
      fields: [purposeVersionInReadmodelPurpose.purposeId],
      references: [purposeInReadmodelPurpose.id],
    }),
    purposeVersionDocumentInReadmodelPurposes: many(
      purposeVersionDocumentInReadmodelPurpose
    ),
  })
);

export const purposeVersionDocumentInReadmodelPurposeRelations = relations(
  purposeVersionDocumentInReadmodelPurpose,
  ({ one }) => ({
    purposeInReadmodelPurpose: one(purposeInReadmodelPurpose, {
      fields: [purposeVersionDocumentInReadmodelPurpose.purposeId],
      references: [purposeInReadmodelPurpose.id],
    }),
    purposeVersionInReadmodelPurpose: one(purposeVersionInReadmodelPurpose, {
      fields: [purposeVersionDocumentInReadmodelPurpose.purposeVersionId],
      references: [purposeVersionInReadmodelPurpose.id],
    }),
  })
);

export const tenantMailInReadmodelTenantRelations = relations(
  tenantMailInReadmodelTenant,
  ({ one }) => ({
    tenantInReadmodelTenant: one(tenantInReadmodelTenant, {
      fields: [tenantMailInReadmodelTenant.tenantId],
      references: [tenantInReadmodelTenant.id],
    }),
  })
);

export const tenantInReadmodelTenantRelations = relations(
  tenantInReadmodelTenant,
  ({ many }) => ({
    tenantMailInReadmodelTenants: many(tenantMailInReadmodelTenant),
    tenantFeatureInReadmodelTenants: many(tenantFeatureInReadmodelTenant),
    tenantVerifiedAttributeInReadmodelTenants: many(
      tenantVerifiedAttributeInReadmodelTenant
    ),
    tenantCertifiedAttributeInReadmodelTenants: many(
      tenantCertifiedAttributeInReadmodelTenant
    ),
    tenantDeclaredAttributeInReadmodelTenants: many(
      tenantDeclaredAttributeInReadmodelTenant
    ),
    tenantVerifiedAttributeVerifierInReadmodelTenants_tenantId: many(
      tenantVerifiedAttributeVerifierInReadmodelTenant,
      {
        relationName:
          "tenantVerifiedAttributeVerifierInReadmodelTenant_tenantId_tenantInReadmodelTenant_id",
      }
    ),
    tenantVerifiedAttributeVerifierInReadmodelTenants_tenantVerifierId: many(
      tenantVerifiedAttributeVerifierInReadmodelTenant,
      {
        relationName:
          "tenantVerifiedAttributeVerifierInReadmodelTenant_tenantVerifierId_tenantInReadmodelTenant_id",
      }
    ),
    tenantVerifiedAttributeRevokerInReadmodelTenants_tenantId: many(
      tenantVerifiedAttributeRevokerInReadmodelTenant,
      {
        relationName:
          "tenantVerifiedAttributeRevokerInReadmodelTenant_tenantId_tenantInReadmodelTenant_id",
      }
    ),
    tenantVerifiedAttributeRevokerInReadmodelTenants_tenantRevokerId: many(
      tenantVerifiedAttributeRevokerInReadmodelTenant,
      {
        relationName:
          "tenantVerifiedAttributeRevokerInReadmodelTenant_tenantRevokerId_tenantInReadmodelTenant_id",
      }
    ),
  })
);

export const tenantFeatureInReadmodelTenantRelations = relations(
  tenantFeatureInReadmodelTenant,
  ({ one }) => ({
    tenantInReadmodelTenant: one(tenantInReadmodelTenant, {
      fields: [tenantFeatureInReadmodelTenant.tenantId],
      references: [tenantInReadmodelTenant.id],
    }),
  })
);

export const producerKeychainUserInReadmodelProducerKeychainRelations =
  relations(producerKeychainUserInReadmodelProducerKeychain, ({ one }) => ({
    producerKeychainInReadmodelProducerKeychain: one(
      producerKeychainInReadmodelProducerKeychain,
      {
        fields: [
          producerKeychainUserInReadmodelProducerKeychain.producerKeychainId,
        ],
        references: [producerKeychainInReadmodelProducerKeychain.id],
      }
    ),
  }));

export const producerKeychainInReadmodelProducerKeychainRelations = relations(
  producerKeychainInReadmodelProducerKeychain,
  ({ many }) => ({
    producerKeychainUserInReadmodelProducerKeychains: many(
      producerKeychainUserInReadmodelProducerKeychain
    ),
    producerKeychainEserviceInReadmodelProducerKeychains: many(
      producerKeychainEserviceInReadmodelProducerKeychain
    ),
    producerKeychainKeyInReadmodelProducerKeychains: many(
      producerKeychainKeyInReadmodelProducerKeychain
    ),
  })
);

export const producerKeychainEserviceInReadmodelProducerKeychainRelations =
  relations(producerKeychainEserviceInReadmodelProducerKeychain, ({ one }) => ({
    producerKeychainInReadmodelProducerKeychain: one(
      producerKeychainInReadmodelProducerKeychain,
      {
        fields: [
          producerKeychainEserviceInReadmodelProducerKeychain.producerKeychainId,
        ],
        references: [producerKeychainInReadmodelProducerKeychain.id],
      }
    ),
  }));

export const clientUserInReadmodelClientRelations = relations(
  clientUserInReadmodelClient,
  ({ one }) => ({
    clientInReadmodelClient: one(clientInReadmodelClient, {
      fields: [clientUserInReadmodelClient.clientId],
      references: [clientInReadmodelClient.id],
    }),
  })
);

export const clientInReadmodelClientRelations = relations(
  clientInReadmodelClient,
  ({ many }) => ({
    clientUserInReadmodelClients: many(clientUserInReadmodelClient),
    clientPurposeInReadmodelClients: many(clientPurposeInReadmodelClient),
    clientKeyInReadmodelClients: many(clientKeyInReadmodelClient),
  })
);

export const clientPurposeInReadmodelClientRelations = relations(
  clientPurposeInReadmodelClient,
  ({ one }) => ({
    clientInReadmodelClient: one(clientInReadmodelClient, {
      fields: [clientPurposeInReadmodelClient.clientId],
      references: [clientInReadmodelClient.id],
    }),
  })
);

export const agreementAttributeInReadmodelAgreementRelations = relations(
  agreementAttributeInReadmodelAgreement,
  ({ one }) => ({
    agreementInReadmodelAgreement: one(agreementInReadmodelAgreement, {
      fields: [agreementAttributeInReadmodelAgreement.agreementId],
      references: [agreementInReadmodelAgreement.id],
    }),
  })
);

export const tenantVerifiedAttributeInReadmodelTenantRelations = relations(
  tenantVerifiedAttributeInReadmodelTenant,
  ({ one, many }) => ({
    tenantInReadmodelTenant: one(tenantInReadmodelTenant, {
      fields: [tenantVerifiedAttributeInReadmodelTenant.tenantId],
      references: [tenantInReadmodelTenant.id],
    }),
    tenantVerifiedAttributeVerifierInReadmodelTenants: many(
      tenantVerifiedAttributeVerifierInReadmodelTenant
    ),
    tenantVerifiedAttributeRevokerInReadmodelTenants: many(
      tenantVerifiedAttributeRevokerInReadmodelTenant
    ),
  })
);

export const delegationStampInReadmodelDelegationRelations = relations(
  delegationStampInReadmodelDelegation,
  ({ one }) => ({
    delegationInReadmodelDelegation: one(delegationInReadmodelDelegation, {
      fields: [delegationStampInReadmodelDelegation.delegationId],
      references: [delegationInReadmodelDelegation.id],
    }),
  })
);

export const tenantCertifiedAttributeInReadmodelTenantRelations = relations(
  tenantCertifiedAttributeInReadmodelTenant,
  ({ one }) => ({
    tenantInReadmodelTenant: one(tenantInReadmodelTenant, {
      fields: [tenantCertifiedAttributeInReadmodelTenant.tenantId],
      references: [tenantInReadmodelTenant.id],
    }),
  })
);

export const agreementStampInReadmodelAgreementRelations = relations(
  agreementStampInReadmodelAgreement,
  ({ one }) => ({
    agreementInReadmodelAgreement: one(agreementInReadmodelAgreement, {
      fields: [agreementStampInReadmodelAgreement.agreementId],
      references: [agreementInReadmodelAgreement.id],
    }),
  })
);

export const tenantDeclaredAttributeInReadmodelTenantRelations = relations(
  tenantDeclaredAttributeInReadmodelTenant,
  ({ one }) => ({
    tenantInReadmodelTenant: one(tenantInReadmodelTenant, {
      fields: [tenantDeclaredAttributeInReadmodelTenant.tenantId],
      references: [tenantInReadmodelTenant.id],
    }),
  })
);

export const eserviceTemplateVersionAttributeInReadmodelEserviceTemplateRelations =
  relations(
    eserviceTemplateVersionAttributeInReadmodelEserviceTemplate,
    ({ one }) => ({
      eserviceTemplateInReadmodelEserviceTemplate: one(
        eserviceTemplateInReadmodelEserviceTemplate,
        {
          fields: [
            eserviceTemplateVersionAttributeInReadmodelEserviceTemplate.eserviceTemplateId,
          ],
          references: [eserviceTemplateInReadmodelEserviceTemplate.id],
        }
      ),
      eserviceTemplateVersionInReadmodelEserviceTemplate: one(
        eserviceTemplateVersionInReadmodelEserviceTemplate,
        {
          fields: [
            eserviceTemplateVersionAttributeInReadmodelEserviceTemplate.eserviceTemplateVersionId,
          ],
          references: [eserviceTemplateVersionInReadmodelEserviceTemplate.id],
        }
      ),
    })
  );

export const eserviceDescriptorAttributeInReadmodelCatalogRelations = relations(
  eserviceDescriptorAttributeInReadmodelCatalog,
  ({ one }) => ({
    eserviceInReadmodelCatalog: one(eserviceInReadmodelCatalog, {
      fields: [eserviceDescriptorAttributeInReadmodelCatalog.eserviceId],
      references: [eserviceInReadmodelCatalog.id],
    }),
    eserviceDescriptorInReadmodelCatalog: one(
      eserviceDescriptorInReadmodelCatalog,
      {
        fields: [eserviceDescriptorAttributeInReadmodelCatalog.descriptorId],
        references: [eserviceDescriptorInReadmodelCatalog.id],
      }
    ),
  })
);

export const tenantVerifiedAttributeVerifierInReadmodelTenantRelations =
  relations(tenantVerifiedAttributeVerifierInReadmodelTenant, ({ one }) => ({
    tenantInReadmodelTenant_tenantId: one(tenantInReadmodelTenant, {
      fields: [tenantVerifiedAttributeVerifierInReadmodelTenant.tenantId],
      references: [tenantInReadmodelTenant.id],
      relationName:
        "tenantVerifiedAttributeVerifierInReadmodelTenant_tenantId_tenantInReadmodelTenant_id",
    }),
    tenantInReadmodelTenant_tenantVerifierId: one(tenantInReadmodelTenant, {
      fields: [
        tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifierId,
      ],
      references: [tenantInReadmodelTenant.id],
      relationName:
        "tenantVerifiedAttributeVerifierInReadmodelTenant_tenantVerifierId_tenantInReadmodelTenant_id",
    }),
    tenantVerifiedAttributeInReadmodelTenant: one(
      tenantVerifiedAttributeInReadmodelTenant,
      {
        fields: [tenantVerifiedAttributeVerifierInReadmodelTenant.tenantId],
        references: [tenantVerifiedAttributeInReadmodelTenant.attributeId],
      }
    ),
  }));

export const clientKeyInReadmodelClientRelations = relations(
  clientKeyInReadmodelClient,
  ({ one }) => ({
    clientInReadmodelClient: one(clientInReadmodelClient, {
      fields: [clientKeyInReadmodelClient.clientId],
      references: [clientInReadmodelClient.id],
    }),
  })
);

export const eserviceTemplateBindingInReadmodelCatalogRelations = relations(
  eserviceTemplateBindingInReadmodelCatalog,
  ({ one }) => ({
    eserviceInReadmodelCatalog: one(eserviceInReadmodelCatalog, {
      fields: [eserviceTemplateBindingInReadmodelCatalog.eserviceId],
      references: [eserviceInReadmodelCatalog.id],
    }),
  })
);

export const producerKeychainKeyInReadmodelProducerKeychainRelations =
  relations(producerKeychainKeyInReadmodelProducerKeychain, ({ one }) => ({
    producerKeychainInReadmodelProducerKeychain: one(
      producerKeychainInReadmodelProducerKeychain,
      {
        fields: [
          producerKeychainKeyInReadmodelProducerKeychain.producerKeychainId,
        ],
        references: [producerKeychainInReadmodelProducerKeychain.id],
      }
    ),
  }));

export const tenantVerifiedAttributeRevokerInReadmodelTenantRelations =
  relations(tenantVerifiedAttributeRevokerInReadmodelTenant, ({ one }) => ({
    tenantInReadmodelTenant_tenantId: one(tenantInReadmodelTenant, {
      fields: [tenantVerifiedAttributeRevokerInReadmodelTenant.tenantId],
      references: [tenantInReadmodelTenant.id],
      relationName:
        "tenantVerifiedAttributeRevokerInReadmodelTenant_tenantId_tenantInReadmodelTenant_id",
    }),
    tenantInReadmodelTenant_tenantRevokerId: one(tenantInReadmodelTenant, {
      fields: [tenantVerifiedAttributeRevokerInReadmodelTenant.tenantRevokerId],
      references: [tenantInReadmodelTenant.id],
      relationName:
        "tenantVerifiedAttributeRevokerInReadmodelTenant_tenantRevokerId_tenantInReadmodelTenant_id",
    }),
    tenantVerifiedAttributeInReadmodelTenant: one(
      tenantVerifiedAttributeInReadmodelTenant,
      {
        fields: [tenantVerifiedAttributeRevokerInReadmodelTenant.tenantId],
        references: [tenantVerifiedAttributeInReadmodelTenant.attributeId],
      }
    ),
  }));
