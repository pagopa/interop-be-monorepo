import { relations } from "drizzle-orm/relations";
import {
  purposeInReadmodel,
  purposeRiskAnalysisFormInReadmodel,
  purposeRiskAnalysisAnswerInReadmodel,
  purposeVersionInReadmodel,
  purposeVersionDocumentInReadmodel,
  producerKeychainInReadmodel,
  producerKeychainKeyInReadmodel,
  tenantInReadmodel,
  tenantMailInReadmodel,
  tenantFeatureInReadmodel,
  eserviceInReadmodel,
  eserviceDescriptorInReadmodel,
  eserviceDescriptorRejectionReasonInReadmodel,
  eserviceDescriptorDocumentInReadmodel,
  eserviceRiskAnalysisInReadmodel,
  eserviceRiskAnalysisAnswerInReadmodel,
  clientInReadmodel,
  clientKeyInReadmodel,
  agreementInReadmodel,
  agreementDocumentInReadmodel,
  delegationInReadmodel,
  delegationContractDocumentInReadmodel,
  eserviceTemplateInReadmodel,
  eserviceTemplateVersionInReadmodel,
  eserviceTemplateVersionDocumentInReadmodel,
  eserviceTemplateRiskAnalysisAnswerInReadmodel,
  eserviceTemplateRiskAnalysisInReadmodel,
  producerKeychainUserInReadmodel,
  producerKeychainEserviceInReadmodel,
  clientUserInReadmodel,
  clientPurposeInReadmodel,
  tenantVerifiedAttributeInReadmodel,
  agreementAttributeInReadmodel,
  attributeInReadmodel,
  tenantCertifiedAttributeInReadmodel,
  tenantDeclaredAttributeInReadmodel,
  delegationStampInReadmodel,
  agreementStampInReadmodel,
  eserviceDescriptorAttributeInReadmodel,
  eserviceTemplateVersionAttributeInReadmodel,
  tenantVerifiedAttributeVerifierInReadmodel,
  tenantVerifiedAttributeRevokerInReadmodel,
  eserviceTemplateBindingInReadmodel,
} from "./schema.js";

export const purposeRiskAnalysisFormInReadmodelRelations = relations(
  purposeRiskAnalysisFormInReadmodel,
  ({ one, many }) => ({
    purposeInReadmodel: one(purposeInReadmodel, {
      fields: [purposeRiskAnalysisFormInReadmodel.purposeId],
      references: [purposeInReadmodel.id],
    }),
    purposeRiskAnalysisAnswerInReadmodels: many(
      purposeRiskAnalysisAnswerInReadmodel
    ),
  })
);

export const purposeInReadmodelRelations = relations(
  purposeInReadmodel,
  ({ many }) => ({
    purposeRiskAnalysisFormInReadmodels: many(
      purposeRiskAnalysisFormInReadmodel
    ),
    purposeRiskAnalysisAnswerInReadmodels: many(
      purposeRiskAnalysisAnswerInReadmodel
    ),
    purposeVersionInReadmodels: many(purposeVersionInReadmodel),
    purposeVersionDocumentInReadmodels: many(purposeVersionDocumentInReadmodel),
  })
);

export const purposeRiskAnalysisAnswerInReadmodelRelations = relations(
  purposeRiskAnalysisAnswerInReadmodel,
  ({ one }) => ({
    purposeInReadmodel: one(purposeInReadmodel, {
      fields: [purposeRiskAnalysisAnswerInReadmodel.purposeId],
      references: [purposeInReadmodel.id],
    }),
    purposeRiskAnalysisFormInReadmodel: one(
      purposeRiskAnalysisFormInReadmodel,
      {
        fields: [purposeRiskAnalysisAnswerInReadmodel.riskAnalysisFormId],
        references: [purposeRiskAnalysisFormInReadmodel.id],
      }
    ),
  })
);

export const purposeVersionInReadmodelRelations = relations(
  purposeVersionInReadmodel,
  ({ one, many }) => ({
    purposeInReadmodel: one(purposeInReadmodel, {
      fields: [purposeVersionInReadmodel.purposeId],
      references: [purposeInReadmodel.id],
    }),
    purposeVersionDocumentInReadmodels: many(purposeVersionDocumentInReadmodel),
  })
);

export const purposeVersionDocumentInReadmodelRelations = relations(
  purposeVersionDocumentInReadmodel,
  ({ one }) => ({
    purposeInReadmodel: one(purposeInReadmodel, {
      fields: [purposeVersionDocumentInReadmodel.purposeId],
      references: [purposeInReadmodel.id],
    }),
    purposeVersionInReadmodel: one(purposeVersionInReadmodel, {
      fields: [purposeVersionDocumentInReadmodel.purposeVersionId],
      references: [purposeVersionInReadmodel.id],
    }),
  })
);

export const producerKeychainKeyInReadmodelRelations = relations(
  producerKeychainKeyInReadmodel,
  ({ one }) => ({
    producerKeychainInReadmodel: one(producerKeychainInReadmodel, {
      fields: [producerKeychainKeyInReadmodel.producerKeychainId],
      references: [producerKeychainInReadmodel.id],
    }),
  })
);

export const producerKeychainInReadmodelRelations = relations(
  producerKeychainInReadmodel,
  ({ many }) => ({
    producerKeychainKeyInReadmodels: many(producerKeychainKeyInReadmodel),
    producerKeychainUserInReadmodels: many(producerKeychainUserInReadmodel),
    producerKeychainEserviceInReadmodels: many(
      producerKeychainEserviceInReadmodel
    ),
  })
);

export const tenantMailInReadmodelRelations = relations(
  tenantMailInReadmodel,
  ({ one }) => ({
    tenantInReadmodel: one(tenantInReadmodel, {
      fields: [tenantMailInReadmodel.tenantId],
      references: [tenantInReadmodel.id],
    }),
  })
);

export const tenantInReadmodelRelations = relations(
  tenantInReadmodel,
  ({ many }) => ({
    tenantMailInReadmodels: many(tenantMailInReadmodel),
    tenantFeatureInReadmodels: many(tenantFeatureInReadmodel),
    tenantVerifiedAttributeInReadmodels: many(
      tenantVerifiedAttributeInReadmodel
    ),
    tenantCertifiedAttributeInReadmodels: many(
      tenantCertifiedAttributeInReadmodel
    ),
    tenantDeclaredAttributeInReadmodels: many(
      tenantDeclaredAttributeInReadmodel
    ),
    tenantVerifiedAttributeVerifierInReadmodels_tenantId: many(
      tenantVerifiedAttributeVerifierInReadmodel,
      {
        relationName:
          "tenantVerifiedAttributeVerifierInReadmodel_tenantId_tenantInReadmodel_id",
      }
    ),
    tenantVerifiedAttributeVerifierInReadmodels_id: many(
      tenantVerifiedAttributeVerifierInReadmodel,
      {
        relationName:
          "tenantVerifiedAttributeVerifierInReadmodel_id_tenantInReadmodel_id",
      }
    ),
    tenantVerifiedAttributeRevokerInReadmodels_tenantId: many(
      tenantVerifiedAttributeRevokerInReadmodel,
      {
        relationName:
          "tenantVerifiedAttributeRevokerInReadmodel_tenantId_tenantInReadmodel_id",
      }
    ),
    tenantVerifiedAttributeRevokerInReadmodels_id: many(
      tenantVerifiedAttributeRevokerInReadmodel,
      {
        relationName:
          "tenantVerifiedAttributeRevokerInReadmodel_id_tenantInReadmodel_id",
      }
    ),
  })
);

export const tenantFeatureInReadmodelRelations = relations(
  tenantFeatureInReadmodel,
  ({ one }) => ({
    tenantInReadmodel: one(tenantInReadmodel, {
      fields: [tenantFeatureInReadmodel.tenantId],
      references: [tenantInReadmodel.id],
    }),
  })
);

export const eserviceDescriptorInReadmodelRelations = relations(
  eserviceDescriptorInReadmodel,
  ({ one, many }) => ({
    eserviceInReadmodel: one(eserviceInReadmodel, {
      fields: [eserviceDescriptorInReadmodel.eserviceId],
      references: [eserviceInReadmodel.id],
    }),
    eserviceDescriptorRejectionReasonInReadmodels: many(
      eserviceDescriptorRejectionReasonInReadmodel
    ),
    eserviceDescriptorDocumentInReadmodels: many(
      eserviceDescriptorDocumentInReadmodel
    ),
    eserviceDescriptorAttributeInReadmodels: many(
      eserviceDescriptorAttributeInReadmodel
    ),
  })
);

export const eserviceInReadmodelRelations = relations(
  eserviceInReadmodel,
  ({ many }) => ({
    eserviceDescriptorInReadmodels: many(eserviceDescriptorInReadmodel),
    eserviceDescriptorRejectionReasonInReadmodels: many(
      eserviceDescriptorRejectionReasonInReadmodel
    ),
    eserviceDescriptorDocumentInReadmodels: many(
      eserviceDescriptorDocumentInReadmodel
    ),
    eserviceRiskAnalysisInReadmodels: many(eserviceRiskAnalysisInReadmodel),
    eserviceRiskAnalysisAnswerInReadmodels: many(
      eserviceRiskAnalysisAnswerInReadmodel
    ),
    producerKeychainEserviceInReadmodels: many(
      producerKeychainEserviceInReadmodel
    ),
    eserviceDescriptorAttributeInReadmodels: many(
      eserviceDescriptorAttributeInReadmodel
    ),
    eserviceTemplateBindingInReadmodels: many(
      eserviceTemplateBindingInReadmodel
    ),
  })
);

export const eserviceDescriptorRejectionReasonInReadmodelRelations = relations(
  eserviceDescriptorRejectionReasonInReadmodel,
  ({ one }) => ({
    eserviceInReadmodel: one(eserviceInReadmodel, {
      fields: [eserviceDescriptorRejectionReasonInReadmodel.eserviceId],
      references: [eserviceInReadmodel.id],
    }),
    eserviceDescriptorInReadmodel: one(eserviceDescriptorInReadmodel, {
      fields: [eserviceDescriptorRejectionReasonInReadmodel.descriptorId],
      references: [eserviceDescriptorInReadmodel.id],
    }),
  })
);

export const eserviceDescriptorDocumentInReadmodelRelations = relations(
  eserviceDescriptorDocumentInReadmodel,
  ({ one }) => ({
    eserviceInReadmodel: one(eserviceInReadmodel, {
      fields: [eserviceDescriptorDocumentInReadmodel.eserviceId],
      references: [eserviceInReadmodel.id],
    }),
    eserviceDescriptorInReadmodel: one(eserviceDescriptorInReadmodel, {
      fields: [eserviceDescriptorDocumentInReadmodel.descriptorId],
      references: [eserviceDescriptorInReadmodel.id],
    }),
  })
);

export const eserviceRiskAnalysisInReadmodelRelations = relations(
  eserviceRiskAnalysisInReadmodel,
  ({ one, many }) => ({
    eserviceInReadmodel: one(eserviceInReadmodel, {
      fields: [eserviceRiskAnalysisInReadmodel.eserviceId],
      references: [eserviceInReadmodel.id],
    }),
    eserviceRiskAnalysisAnswerInReadmodels: many(
      eserviceRiskAnalysisAnswerInReadmodel
    ),
    eserviceTemplateRiskAnalysisAnswerInReadmodels: many(
      eserviceTemplateRiskAnalysisAnswerInReadmodel
    ),
  })
);

export const eserviceRiskAnalysisAnswerInReadmodelRelations = relations(
  eserviceRiskAnalysisAnswerInReadmodel,
  ({ one }) => ({
    eserviceInReadmodel: one(eserviceInReadmodel, {
      fields: [eserviceRiskAnalysisAnswerInReadmodel.eserviceId],
      references: [eserviceInReadmodel.id],
    }),
    eserviceRiskAnalysisInReadmodel: one(eserviceRiskAnalysisInReadmodel, {
      fields: [eserviceRiskAnalysisAnswerInReadmodel.riskAnalysisFormId],
      references: [eserviceRiskAnalysisInReadmodel.riskAnalysisFormId],
    }),
  })
);

export const clientKeyInReadmodelRelations = relations(
  clientKeyInReadmodel,
  ({ one }) => ({
    clientInReadmodel: one(clientInReadmodel, {
      fields: [clientKeyInReadmodel.clientId],
      references: [clientInReadmodel.id],
    }),
  })
);

export const clientInReadmodelRelations = relations(
  clientInReadmodel,
  ({ many }) => ({
    clientKeyInReadmodels: many(clientKeyInReadmodel),
    clientUserInReadmodels: many(clientUserInReadmodel),
    clientPurposeInReadmodels: many(clientPurposeInReadmodel),
  })
);

export const agreementDocumentInReadmodelRelations = relations(
  agreementDocumentInReadmodel,
  ({ one }) => ({
    agreementInReadmodel: one(agreementInReadmodel, {
      fields: [agreementDocumentInReadmodel.agreementId],
      references: [agreementInReadmodel.id],
    }),
  })
);

export const agreementInReadmodelRelations = relations(
  agreementInReadmodel,
  ({ many }) => ({
    agreementDocumentInReadmodels: many(agreementDocumentInReadmodel),
    agreementAttributeInReadmodels: many(agreementAttributeInReadmodel),
    agreementStampInReadmodels: many(agreementStampInReadmodel),
  })
);

export const delegationContractDocumentInReadmodelRelations = relations(
  delegationContractDocumentInReadmodel,
  ({ one }) => ({
    delegationInReadmodel: one(delegationInReadmodel, {
      fields: [delegationContractDocumentInReadmodel.delegationId],
      references: [delegationInReadmodel.id],
    }),
  })
);

export const delegationInReadmodelRelations = relations(
  delegationInReadmodel,
  ({ many }) => ({
    delegationContractDocumentInReadmodels: many(
      delegationContractDocumentInReadmodel
    ),
    delegationStampInReadmodels: many(delegationStampInReadmodel),
  })
);

export const eserviceTemplateVersionInReadmodelRelations = relations(
  eserviceTemplateVersionInReadmodel,
  ({ one, many }) => ({
    eserviceTemplateInReadmodel: one(eserviceTemplateInReadmodel, {
      fields: [eserviceTemplateVersionInReadmodel.eserviceTemplateId],
      references: [eserviceTemplateInReadmodel.id],
    }),
    eserviceTemplateVersionDocumentInReadmodels: many(
      eserviceTemplateVersionDocumentInReadmodel
    ),
    eserviceTemplateVersionAttributeInReadmodels: many(
      eserviceTemplateVersionAttributeInReadmodel
    ),
  })
);

export const eserviceTemplateInReadmodelRelations = relations(
  eserviceTemplateInReadmodel,
  ({ many }) => ({
    eserviceTemplateVersionInReadmodels: many(
      eserviceTemplateVersionInReadmodel
    ),
    eserviceTemplateVersionDocumentInReadmodels: many(
      eserviceTemplateVersionDocumentInReadmodel
    ),
    eserviceTemplateRiskAnalysisAnswerInReadmodels: many(
      eserviceTemplateRiskAnalysisAnswerInReadmodel
    ),
    eserviceTemplateRiskAnalysisInReadmodels: many(
      eserviceTemplateRiskAnalysisInReadmodel
    ),
    eserviceTemplateVersionAttributeInReadmodels: many(
      eserviceTemplateVersionAttributeInReadmodel
    ),
  })
);

export const eserviceTemplateVersionDocumentInReadmodelRelations = relations(
  eserviceTemplateVersionDocumentInReadmodel,
  ({ one }) => ({
    eserviceTemplateInReadmodel: one(eserviceTemplateInReadmodel, {
      fields: [eserviceTemplateVersionDocumentInReadmodel.eserviceTemplateId],
      references: [eserviceTemplateInReadmodel.id],
    }),
    eserviceTemplateVersionInReadmodel: one(
      eserviceTemplateVersionInReadmodel,
      {
        fields: [
          eserviceTemplateVersionDocumentInReadmodel.eserviceTemplateVersionId,
        ],
        references: [eserviceTemplateVersionInReadmodel.id],
      }
    ),
  })
);

export const eserviceTemplateRiskAnalysisAnswerInReadmodelRelations = relations(
  eserviceTemplateRiskAnalysisAnswerInReadmodel,
  ({ one }) => ({
    eserviceTemplateInReadmodel: one(eserviceTemplateInReadmodel, {
      fields: [
        eserviceTemplateRiskAnalysisAnswerInReadmodel.eserviceTemplateId,
      ],
      references: [eserviceTemplateInReadmodel.id],
    }),
    eserviceRiskAnalysisInReadmodel: one(eserviceRiskAnalysisInReadmodel, {
      fields: [
        eserviceTemplateRiskAnalysisAnswerInReadmodel.riskAnalysisFormId,
      ],
      references: [eserviceRiskAnalysisInReadmodel.riskAnalysisFormId],
    }),
  })
);

export const eserviceTemplateRiskAnalysisInReadmodelRelations = relations(
  eserviceTemplateRiskAnalysisInReadmodel,
  ({ one }) => ({
    eserviceTemplateInReadmodel: one(eserviceTemplateInReadmodel, {
      fields: [eserviceTemplateRiskAnalysisInReadmodel.eserviceTemplateId],
      references: [eserviceTemplateInReadmodel.id],
    }),
  })
);

export const producerKeychainUserInReadmodelRelations = relations(
  producerKeychainUserInReadmodel,
  ({ one }) => ({
    producerKeychainInReadmodel: one(producerKeychainInReadmodel, {
      fields: [producerKeychainUserInReadmodel.producerKeychainId],
      references: [producerKeychainInReadmodel.id],
    }),
  })
);

export const producerKeychainEserviceInReadmodelRelations = relations(
  producerKeychainEserviceInReadmodel,
  ({ one }) => ({
    producerKeychainInReadmodel: one(producerKeychainInReadmodel, {
      fields: [producerKeychainEserviceInReadmodel.producerKeychainId],
      references: [producerKeychainInReadmodel.id],
    }),
    eserviceInReadmodel: one(eserviceInReadmodel, {
      fields: [producerKeychainEserviceInReadmodel.eserviceId],
      references: [eserviceInReadmodel.id],
    }),
  })
);

export const clientUserInReadmodelRelations = relations(
  clientUserInReadmodel,
  ({ one }) => ({
    clientInReadmodel: one(clientInReadmodel, {
      fields: [clientUserInReadmodel.clientId],
      references: [clientInReadmodel.id],
    }),
  })
);

export const clientPurposeInReadmodelRelations = relations(
  clientPurposeInReadmodel,
  ({ one }) => ({
    clientInReadmodel: one(clientInReadmodel, {
      fields: [clientPurposeInReadmodel.clientId],
      references: [clientInReadmodel.id],
    }),
  })
);

export const tenantVerifiedAttributeInReadmodelRelations = relations(
  tenantVerifiedAttributeInReadmodel,
  ({ one, many }) => ({
    tenantInReadmodel: one(tenantInReadmodel, {
      fields: [tenantVerifiedAttributeInReadmodel.tenantId],
      references: [tenantInReadmodel.id],
    }),
    tenantVerifiedAttributeVerifierInReadmodels: many(
      tenantVerifiedAttributeVerifierInReadmodel
    ),
    tenantVerifiedAttributeRevokerInReadmodels: many(
      tenantVerifiedAttributeRevokerInReadmodel
    ),
  })
);

export const agreementAttributeInReadmodelRelations = relations(
  agreementAttributeInReadmodel,
  ({ one }) => ({
    agreementInReadmodel: one(agreementInReadmodel, {
      fields: [agreementAttributeInReadmodel.agreementId],
      references: [agreementInReadmodel.id],
    }),
  })
);

export const tenantCertifiedAttributeInReadmodelRelations = relations(
  tenantCertifiedAttributeInReadmodel,
  ({ one }) => ({
    attributeInReadmodel: one(attributeInReadmodel, {
      fields: [tenantCertifiedAttributeInReadmodel.id],
      references: [attributeInReadmodel.id],
    }),
    tenantInReadmodel: one(tenantInReadmodel, {
      fields: [tenantCertifiedAttributeInReadmodel.tenantId],
      references: [tenantInReadmodel.id],
    }),
  })
);

export const attributeInReadmodelRelations = relations(
  attributeInReadmodel,
  ({ many }) => ({
    tenantCertifiedAttributeInReadmodels: many(
      tenantCertifiedAttributeInReadmodel
    ),
    tenantVerifiedAttributeVerifierInReadmodels: many(
      tenantVerifiedAttributeVerifierInReadmodel
    ),
  })
);

export const tenantDeclaredAttributeInReadmodelRelations = relations(
  tenantDeclaredAttributeInReadmodel,
  ({ one }) => ({
    tenantInReadmodel: one(tenantInReadmodel, {
      fields: [tenantDeclaredAttributeInReadmodel.tenantId],
      references: [tenantInReadmodel.id],
    }),
  })
);

export const delegationStampInReadmodelRelations = relations(
  delegationStampInReadmodel,
  ({ one }) => ({
    delegationInReadmodel: one(delegationInReadmodel, {
      fields: [delegationStampInReadmodel.delegationId],
      references: [delegationInReadmodel.id],
    }),
  })
);

export const agreementStampInReadmodelRelations = relations(
  agreementStampInReadmodel,
  ({ one }) => ({
    agreementInReadmodel: one(agreementInReadmodel, {
      fields: [agreementStampInReadmodel.agreementId],
      references: [agreementInReadmodel.id],
    }),
  })
);

export const eserviceDescriptorAttributeInReadmodelRelations = relations(
  eserviceDescriptorAttributeInReadmodel,
  ({ one }) => ({
    eserviceInReadmodel: one(eserviceInReadmodel, {
      fields: [eserviceDescriptorAttributeInReadmodel.eserviceId],
      references: [eserviceInReadmodel.id],
    }),
    eserviceDescriptorInReadmodel: one(eserviceDescriptorInReadmodel, {
      fields: [eserviceDescriptorAttributeInReadmodel.descriptorId],
      references: [eserviceDescriptorInReadmodel.id],
    }),
  })
);

export const eserviceTemplateVersionAttributeInReadmodelRelations = relations(
  eserviceTemplateVersionAttributeInReadmodel,
  ({ one }) => ({
    eserviceTemplateInReadmodel: one(eserviceTemplateInReadmodel, {
      fields: [eserviceTemplateVersionAttributeInReadmodel.eserviceTemplateId],
      references: [eserviceTemplateInReadmodel.id],
    }),
    eserviceTemplateVersionInReadmodel: one(
      eserviceTemplateVersionInReadmodel,
      {
        fields: [
          eserviceTemplateVersionAttributeInReadmodel.eserviceTemplateVersionId,
        ],
        references: [eserviceTemplateVersionInReadmodel.id],
      }
    ),
  })
);

export const tenantVerifiedAttributeVerifierInReadmodelRelations = relations(
  tenantVerifiedAttributeVerifierInReadmodel,
  ({ one }) => ({
    tenantInReadmodel_tenantId: one(tenantInReadmodel, {
      fields: [tenantVerifiedAttributeVerifierInReadmodel.tenantId],
      references: [tenantInReadmodel.id],
      relationName:
        "tenantVerifiedAttributeVerifierInReadmodel_tenantId_tenantInReadmodel_id",
    }),
    tenantInReadmodel_id: one(tenantInReadmodel, {
      fields: [tenantVerifiedAttributeVerifierInReadmodel.id],
      references: [tenantInReadmodel.id],
      relationName:
        "tenantVerifiedAttributeVerifierInReadmodel_id_tenantInReadmodel_id",
    }),
    attributeInReadmodel: one(attributeInReadmodel, {
      fields: [
        tenantVerifiedAttributeVerifierInReadmodel.tenantVerifiedAttributeId,
      ],
      references: [attributeInReadmodel.id],
    }),
    tenantVerifiedAttributeInReadmodel: one(
      tenantVerifiedAttributeInReadmodel,
      {
        fields: [tenantVerifiedAttributeVerifierInReadmodel.tenantId],
        references: [tenantVerifiedAttributeInReadmodel.attributeId],
      }
    ),
  })
);

export const tenantVerifiedAttributeRevokerInReadmodelRelations = relations(
  tenantVerifiedAttributeRevokerInReadmodel,
  ({ one }) => ({
    tenantInReadmodel_tenantId: one(tenantInReadmodel, {
      fields: [tenantVerifiedAttributeRevokerInReadmodel.tenantId],
      references: [tenantInReadmodel.id],
      relationName:
        "tenantVerifiedAttributeRevokerInReadmodel_tenantId_tenantInReadmodel_id",
    }),
    tenantInReadmodel_id: one(tenantInReadmodel, {
      fields: [tenantVerifiedAttributeRevokerInReadmodel.id],
      references: [tenantInReadmodel.id],
      relationName:
        "tenantVerifiedAttributeRevokerInReadmodel_id_tenantInReadmodel_id",
    }),
    tenantVerifiedAttributeInReadmodel: one(
      tenantVerifiedAttributeInReadmodel,
      {
        fields: [tenantVerifiedAttributeRevokerInReadmodel.tenantId],
        references: [tenantVerifiedAttributeInReadmodel.attributeId],
      }
    ),
  })
);

export const eserviceTemplateBindingInReadmodelRelations = relations(
  eserviceTemplateBindingInReadmodel,
  ({ one }) => ({
    eserviceInReadmodel: one(eserviceInReadmodel, {
      fields: [eserviceTemplateBindingInReadmodel.eserviceId],
      references: [eserviceInReadmodel.id],
    }),
  })
);
