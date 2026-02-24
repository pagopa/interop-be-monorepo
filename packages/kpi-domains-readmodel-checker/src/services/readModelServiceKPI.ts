import {
  Agreement,
  Attribute,
  Client,
  Delegation,
  EService,
  EServiceTemplate,
  ProducerKeychain,
  Purpose,
  PurposeTemplate,
  Tenant,
  WithMetadata,
} from "pagopa-interop-models";
import {
  aggregateAttributeArray,
  aggregateEserviceArray,
  aggregateTenantArray,
  aggregatePurposeArray,
  aggregateAgreementArray,
  aggregateClientArray,
  aggregateProducerKeychainArray,
  aggregateDelegationsArray,
  aggregateEServiceTemplateArray,
  aggregatePurposeTemplateArray,
} from "pagopa-interop-readmodel";
import { z } from "zod";
import { IConnected, IMain } from "pg-promise";
import { IClient } from "pg-promise/typescript/pg-subset.js";
import camelcaseKeys from "camelcase-keys";
import { config } from "../configs/config.js";
import { TenantDbTable } from "../model/db/tenant.js";
import { AgreementDbTable } from "../model/db/agreement.js";
import { AttributeDbTable } from "../model/db/attribute.js";
import {
  ClientDbTable,
  ProducerKeychainDbTable,
} from "../model/db/authorization.js";
import { CatalogDbTable } from "../model/db/catalog.js";
import { DelegationDbTable } from "../model/db/delegation.js";
import { EserviceTemplateDbTable } from "../model/db/eserviceTemplate.js";
import { PurposeDbTable } from "../model/db/purpose.js";
import { DomainDbTable, DomainDbTableSchemas } from "../model/db/index.js";
import { PurposeTemplateDbTable } from "../model/db/purposeTemplate.js";

type DBConnection = IConnected<unknown, IClient>;
export type DBContext = {
  conn: DBConnection;
  pgp: IMain;
};

async function getManyFromDb<T extends DomainDbTable>(
  db: DBContext,
  tableName: T
  // where: Partial<z.infer<DomainDbTableSchemas[T]>>
): Promise<Array<z.infer<DomainDbTableSchemas[T]>>> {
  const rows = await db.conn.any(
    `SELECT * FROM ${config.dbSchemaName}.${tableName} WHERE NOT COALESCE(deleted, false)`
  );

  return rows.map((row) => camelcaseKeys(row));
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderKPI(dbContext: DBContext) {
  return {
    async getAllAttributes(): Promise<Array<WithMetadata<Attribute>>> {
      const res = await getManyFromDb(dbContext, AttributeDbTable.attribute);

      return aggregateAttributeArray(res);
    },

    async getAllEServices(): Promise<Array<WithMetadata<EService>>> {
      const eservicesSQL = await getManyFromDb(
        dbContext,
        CatalogDbTable.eservice
      );
      const descriptorsSQL = await getManyFromDb(
        dbContext,
        CatalogDbTable.eservice_descriptor
      );
      const interfacesSQL = await getManyFromDb(
        dbContext,
        CatalogDbTable.eservice_descriptor_interface
      );
      const documentsSQL = await getManyFromDb(
        dbContext,
        CatalogDbTable.eservice_descriptor_document
      );
      const attributesSQL = await getManyFromDb(
        dbContext,
        CatalogDbTable.eservice_descriptor_attribute
      );
      const rejectionReasonsSQL = await getManyFromDb(
        dbContext,
        CatalogDbTable.eservice_descriptor_rejection_reason
      );
      const riskAnalysesSQL = await getManyFromDb(
        dbContext,
        CatalogDbTable.eservice_risk_analysis
      );
      const riskAnalysisAnswersSQL = await getManyFromDb(
        dbContext,
        CatalogDbTable.eservice_risk_analysis_answer
      );
      const templateVersionRefsSQL = await getManyFromDb(
        dbContext,
        CatalogDbTable.eservice_descriptor_template_version_ref
      );

      return aggregateEserviceArray({
        eservicesSQL,
        descriptorsSQL: descriptorsSQL.map((d) => ({
          ...d,
          audience: JSON.parse(d.audience),
          serverUrls: JSON.parse(d.serverUrls),
        })),
        interfacesSQL,
        documentsSQL,
        attributesSQL,
        rejectionReasonsSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL: riskAnalysisAnswersSQL.map((ra) => ({
          ...ra,
          value: JSON.parse(ra.value),
        })),
        templateVersionRefsSQL,
      });
    },

    async getAllEServiceTemplates(): Promise<
      Array<WithMetadata<EServiceTemplate>>
    > {
      const eserviceTemplatesSQL = await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template
      );
      const riskAnalysesSQL = await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_risk_analysis
      );
      const riskAnalysisAnswersSQL = await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_risk_analysis_answer
      );
      const versionsSQL = await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version
      );
      const attributesSQL = await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version_attribute
      );
      const interfacesSQL = await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version_interface
      );
      const documentsSQL = await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version_document
      );
      return aggregateEServiceTemplateArray({
        eserviceTemplatesSQL,
        riskAnalysesSQL,
        riskAnalysisAnswersSQL: riskAnalysisAnswersSQL.map((ra) => ({
          ...ra,
          value: JSON.parse(ra.value),
        })),
        versionsSQL,
        attributesSQL,
        interfacesSQL,
        documentsSQL,
      });
    },

    async getAllTenants(): Promise<Array<WithMetadata<Tenant>>> {
      const tenantsSQL = await getManyFromDb(dbContext, TenantDbTable.tenant);
      const mailsSQL = await getManyFromDb(
        dbContext,
        TenantDbTable.tenant_mail
      );
      const certifiedAttributesSQL = await getManyFromDb(
        dbContext,
        TenantDbTable.tenant_certified_attribute
      );
      const declaredAttributesSQL = await getManyFromDb(
        dbContext,
        TenantDbTable.tenant_declared_attribute
      );
      const verifiedAttributesSQL = await getManyFromDb(
        dbContext,
        TenantDbTable.tenant_verified_attribute
      );
      const verifiedAttributeVerifiersSQL = await getManyFromDb(
        dbContext,
        TenantDbTable.tenant_verified_attribute_verifier
      );
      const verifiedAttributeRevokersSQL = await getManyFromDb(
        dbContext,
        TenantDbTable.tenant_verified_attribute_revoker
      );
      const featuresSQL = await getManyFromDb(
        dbContext,
        TenantDbTable.tenant_feature
      );
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
    },

    async getAllPurposes(): Promise<Array<WithMetadata<Purpose>>> {
      const purposesSQL = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose
      );
      const riskAnalysisFormsSQL = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_risk_analysis_form
      );
      const riskAnalysisAnswersSQL = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_risk_analysis_answer
      );
      const versionsSQL = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_version
      );
      const versionDocumentsSQL = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_version_document
      );
      const versionStampsSQL = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_version_stamp
      );
      const versionSignedDocumentsSQL = await getManyFromDb(
        dbContext,
        PurposeDbTable.purpose_version_signed_document
      );

      return aggregatePurposeArray({
        purposesSQL,
        riskAnalysisFormsSQL,
        riskAnalysisAnswersSQL: riskAnalysisAnswersSQL.map((ra) => ({
          ...ra,
          value: JSON.parse(ra.value),
        })),
        versionsSQL,
        versionDocumentsSQL,
        versionStampsSQL,
        versionSignedDocumentsSQL,
      });
    },

    async getAllAgreements(): Promise<Array<WithMetadata<Agreement>>> {
      const agreementsSQL = await getManyFromDb(
        dbContext,
        AgreementDbTable.agreement
      );
      const stampsSQL = await getManyFromDb(
        dbContext,
        AgreementDbTable.agreement_stamp
      );
      const consumerDocumentsSQL = await getManyFromDb(
        dbContext,
        AgreementDbTable.agreement_consumer_document
      );
      const contractsSQL = await getManyFromDb(
        dbContext,
        AgreementDbTable.agreement_contract
      );
      const attributesSQL = await getManyFromDb(
        dbContext,
        AgreementDbTable.agreement_attribute
      );
      const signedContractsSQL = await getManyFromDb(
        dbContext,
        AgreementDbTable.agreement_signed_contract
      );

      return aggregateAgreementArray({
        agreementsSQL,
        stampsSQL,
        consumerDocumentsSQL,
        contractsSQL,
        attributesSQL,
        signedContractsSQL,
      });
    },

    async getAllClients(): Promise<Array<WithMetadata<Client>>> {
      const clientsSQL = await getManyFromDb(dbContext, ClientDbTable.client);
      const usersSQL = await getManyFromDb(
        dbContext,
        ClientDbTable.client_user
      );
      const purposesSQL = await getManyFromDb(
        dbContext,
        ClientDbTable.client_purpose
      );
      const keysSQL = await getManyFromDb(dbContext, ClientDbTable.client_key);

      return aggregateClientArray({
        clientsSQL,
        usersSQL,
        purposesSQL,
        keysSQL,
      });
    },

    async getAllProducerKeychains(): Promise<
      Array<WithMetadata<ProducerKeychain>>
    > {
      const producerKeychainsSQL = await getManyFromDb(
        dbContext,
        ProducerKeychainDbTable.producer_keychain
      );
      const usersSQL = await getManyFromDb(
        dbContext,
        ProducerKeychainDbTable.producer_keychain_user
      );
      const eservicesSQL = await getManyFromDb(
        dbContext,
        ProducerKeychainDbTable.producer_keychain_eservice
      );
      const keysSQL = await getManyFromDb(
        dbContext,
        ProducerKeychainDbTable.producer_keychain_key
      );

      return aggregateProducerKeychainArray({
        producerKeychainsSQL,
        usersSQL,
        eservicesSQL,
        keysSQL,
      });
    },

    async getAllDelegations(): Promise<Array<WithMetadata<Delegation>>> {
      const delegationsSQL = await getManyFromDb(
        dbContext,
        DelegationDbTable.delegation
      );
      const contractDocumentsSQL = await getManyFromDb(
        dbContext,
        DelegationDbTable.delegation_contract_document
      );
      const stampsSQL = await getManyFromDb(
        dbContext,
        DelegationDbTable.delegation_stamp
      );

      const contractSignedDocumentsSQL = await getManyFromDb(
        dbContext,
        DelegationDbTable.delegation_signed_contract_document
      );

      return aggregateDelegationsArray({
        delegationsSQL,
        contractDocumentsSQL,
        stampsSQL,
        contractSignedDocumentsSQL,
      });
    },

    async getAllPurposeTemplates(): Promise<
      Array<WithMetadata<PurposeTemplate>>
    > {
      const purposeTemplatesSQL = await getManyFromDb(
        dbContext,
        PurposeTemplateDbTable.purpose_template
      );
      const riskAnalysisFormTemplatesSQL = await getManyFromDb(
        dbContext,
        PurposeTemplateDbTable.purpose_template_risk_analysis_form
      );
      const riskAnalysisTemplateAnswersSQL = await getManyFromDb(
        dbContext,
        PurposeTemplateDbTable.purpose_template_risk_analysis_answer
      );
      const riskAnalysisTemplateAnswersAnnotationsSQL = await getManyFromDb(
        dbContext,
        PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation
      );
      const riskAnalysisTemplateAnswersAnnotationsDocumentsSQL =
        await getManyFromDb(
          dbContext,
          PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation_document
        );

      return aggregatePurposeTemplateArray({
        purposeTemplatesSQL,
        riskAnalysisFormTemplatesSQL,
        riskAnalysisTemplateAnswersSQL: riskAnalysisTemplateAnswersSQL.map(
          (ra) => ({
            ...ra,
            value: JSON.parse(ra.value),
            suggestedValues: ra.suggestedValues
              ? JSON.parse(ra.suggestedValues)
              : null,
          })
        ),
        riskAnalysisTemplateAnswersAnnotationsSQL,
        riskAnalysisTemplateAnswersAnnotationsDocumentsSQL,
      });
    },
  };
}
