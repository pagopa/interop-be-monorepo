import {
  eq,
  desc,
  asc,
  and,
  gte,
  isNotNull,
  isNull,
  count,
  inArray,
  gt,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Logger, withTotalCount } from "pagopa-interop-commons";
import {
  TenantId,
  UserId,
  UserRole,
  unsafeBrandId,
  EServiceId,
  DescriptorId,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  userNotificationConfigInReadmodelNotificationConfig,
  eserviceDescriptorInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  agreementInReadmodelAgreement,
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  eserviceTemplateInReadmodelEserviceTemplate,
  eserviceTemplateVersionInReadmodelEserviceTemplate,
  tenantInReadmodelTenant,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenantCertifiedAttributeInReadmodelTenant,
  attributeInReadmodelAttribute,
} from "pagopa-interop-readmodel-models";
import { config } from "../config/config.js";

const DIGEST_FREQUENCY_DAYS = config.digestFrequencyDays;

export type DigestUser = {
  userId: UserId;
  tenantId: TenantId;
  userRoles: UserRole[];
};

export type NewEservice = {
  eserviceId: EServiceId;
  eserviceDescriptorId: DescriptorId;
  eserviceName: string;
  eserviceProducerId: TenantId;
  agreementCount: number;
  totalCount: number;
};

export type NewEserviceTemplate = {
  eserviceTemplateId: string;
  eserviceTemplateVersionId: string;
  eserviceTemplateName: string;
  eserviceTemplateProducerId: TenantId;
  totalCount: number;
};

type AttributeBase = {
  attributeName: string;
  totalCount: number;
};

export type VerifiedAssignedAttribute = AttributeBase & {
  state: "assigned";
  actionPerformer: TenantId;
};

export type VerifiedRevokedAttribute = AttributeBase & {
  state: "revoked";
  actionPerformer: TenantId;
};

export type CertifiedAssignedAttribute = AttributeBase & {
  state: "assigned";
};

export type CertifiedRevokedAttribute = AttributeBase & {
  state: "revoked";
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(db: DrizzleReturnType, logger: Logger) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - DIGEST_FREQUENCY_DAYS);
  return {
    /**
     * Returns the list of new e-services published in the last TIME_INTERVAL_IN_DAYS days
     */
    async getNewEservices(
      priorityProducerIds: TenantId[]
    ): Promise<NewEservice[]> {
      logger.info(
        `Retrieving new e-services published since ${dateThreshold.toISOString()}`
      );
      const priorityField = inArray(
        eserviceInReadmodelCatalog.producerId,
        priorityProducerIds
      );

      const results = await db
        .select(
          withTotalCount({
            eserviceId: eserviceInReadmodelCatalog.id,
            eserviceDescriptorId: eserviceDescriptorInReadmodelCatalog.id,
            eserviceName: eserviceInReadmodelCatalog.name,
            eserviceProducerId: eserviceInReadmodelCatalog.producerId,
            agreementCount: count(agreementInReadmodelAgreement.id).as(
              "agreementCount"
            ),
          })
        )
        .from(eserviceDescriptorInReadmodelCatalog)
        .innerJoin(
          eserviceInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            eserviceDescriptorInReadmodelCatalog.eserviceId
          )
        )
        .leftJoin(
          agreementInReadmodelAgreement,
          eq(
            eserviceInReadmodelCatalog.id,
            agreementInReadmodelAgreement.eserviceId
          )
        )
        .where(
          and(
            eq(eserviceDescriptorInReadmodelCatalog.state, "Published"),
            gte(
              eserviceDescriptorInReadmodelCatalog.publishedAt,
              dateThreshold.toISOString()
            ),
            isNotNull(eserviceDescriptorInReadmodelCatalog.publishedAt)
          )
        )
        .groupBy(
          eserviceInReadmodelCatalog.id,
          eserviceDescriptorInReadmodelCatalog.id,
          eserviceDescriptorInReadmodelCatalog.publishedAt,
          eserviceInReadmodelCatalog.name,
          eserviceInReadmodelCatalog.producerId
        )
        .orderBy(
          desc(priorityField),
          desc(count(agreementInReadmodelAgreement.id)),
          asc(eserviceDescriptorInReadmodelCatalog.publishedAt)
        )
        .limit(5);

      logger.info(`Retrieved ${results.length} new e-services`);

      return results.map((row) => ({
        eserviceId: unsafeBrandId<EServiceId>(row.eserviceId),
        eserviceDescriptorId: unsafeBrandId<DescriptorId>(
          row.eserviceDescriptorId
        ),
        eserviceName: row.eserviceName,
        eserviceProducerId: unsafeBrandId<TenantId>(row.eserviceProducerId),
        agreementCount: row.agreementCount,
        totalCount: row.totalCount,
      }));
    },

    /**
     * Returns the new versions of the e-services the user subscribed to
     */
    async getNewVersionEservices(consumerId: TenantId): Promise<NewEservice[]> {
      logger.info(
        `Retrieving new versions of e-services for consumer ${consumerId} since ${dateThreshold.toISOString()}`
      );
      // Create proper aliases for the same table
      const agreementDesc = alias(
        eserviceDescriptorInReadmodelCatalog,
        "agreement_desc"
      );
      const newDesc = alias(eserviceDescriptorInReadmodelCatalog, "new_desc");

      const results = await db
        .selectDistinct({
          eserviceId: eserviceInReadmodelCatalog.id,
          eserviceDescriptorId: newDesc.id,
          eserviceName: eserviceInReadmodelCatalog.name,
          eserviceProducerId: eserviceInReadmodelCatalog.producerId,
          newVersion: newDesc.version,
          agreementVersion: agreementDesc.version,
          agreementCount: count(agreementInReadmodelAgreement.id).as(
            "agreementCount"
          ),
        })
        .from(agreementInReadmodelAgreement)
        .innerJoin(
          eserviceInReadmodelCatalog,
          eq(
            agreementInReadmodelAgreement.eserviceId,
            eserviceInReadmodelCatalog.id
          )
        )
        .innerJoin(
          agreementDesc,
          eq(agreementInReadmodelAgreement.descriptorId, agreementDesc.id)
        )
        .innerJoin(
          newDesc,
          eq(agreementInReadmodelAgreement.eserviceId, newDesc.eserviceId)
        )
        .where(
          and(
            eq(agreementInReadmodelAgreement.consumerId, consumerId),
            eq(agreementInReadmodelAgreement.state, "Active"),
            eq(newDesc.state, "Published"),
            gte(newDesc.publishedAt, dateThreshold.toISOString()),
            isNotNull(newDesc.publishedAt)
          )
        )
        .groupBy(
          eserviceInReadmodelCatalog.id,
          newDesc.id,
          newDesc.version,
          agreementDesc.version,
          eserviceInReadmodelCatalog.name,
          eserviceInReadmodelCatalog.producerId
        );

      // Filter results where newVersion > agreementVersion (as integers) and limit to 5
      const filteredResults = results
        .filter((row) => {
          const newVersionInt = parseInt(row.newVersion, 10);
          const agreementVersionInt = parseInt(row.agreementVersion, 10);
          return (
            !isNaN(newVersionInt) &&
            !isNaN(agreementVersionInt) &&
            newVersionInt > agreementVersionInt
          );
        })
        .slice(0, 5);

      logger.info(
        `Retrieved ${filteredResults.length} new e-service versions for consumer ${consumerId}`
      );

      return filteredResults.map((row) => ({
        eserviceId: unsafeBrandId<EServiceId>(row.eserviceId),
        eserviceDescriptorId: unsafeBrandId<DescriptorId>(
          row.eserviceDescriptorId
        ),
        eserviceName: row.eserviceName,
        eserviceProducerId: unsafeBrandId<TenantId>(row.eserviceProducerId),
        agreementCount: row.agreementCount,
        totalCount: filteredResults.length,
      }));
    },

    async getNewEserviceTemplates(
      consumerId: TenantId
    ): Promise<NewEserviceTemplate[]> {
      logger.info(
        `Retrieving new e-service templates for consumer ${consumerId} since ${dateThreshold.toISOString()}`
      );
      const templateVersionUsed = alias(
        eserviceTemplateVersionInReadmodelEserviceTemplate,
        "template_version_used"
      );
      const templateVersionNew = alias(
        eserviceTemplateVersionInReadmodelEserviceTemplate,
        "template_version_new"
      );
      const templateUsage = db
        .select({
          templateId: eserviceInReadmodelCatalog.templateId,
          templateUsageCount: count(eserviceInReadmodelCatalog.id).as(
            "templateUsageCount"
          ),
        })
        .from(eserviceInReadmodelCatalog)
        .where(isNotNull(eserviceInReadmodelCatalog.templateId))
        .groupBy(eserviceInReadmodelCatalog.templateId)
        .as("template_usage");

      const results = await db
        .select(
          withTotalCount({
            eserviceTemplateId: eserviceTemplateInReadmodelEserviceTemplate.id,
            templateVersionId: templateVersionNew.id,
            templateVersionCreatedAt: templateVersionNew.createdAt,
            eserviceTemplateName:
              eserviceTemplateInReadmodelEserviceTemplate.name,
            eserviceTemplateProducerId:
              eserviceTemplateInReadmodelEserviceTemplate.creatorId,
            templateUsageCount: templateUsage.templateUsageCount,
          })
        )
        .from(eserviceInReadmodelCatalog)
        .innerJoin(
          eserviceDescriptorInReadmodelCatalog,
          eq(
            eserviceDescriptorInReadmodelCatalog.eserviceId,
            eserviceInReadmodelCatalog.id
          )
        )
        .innerJoin(
          eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
          eq(
            eserviceDescriptorTemplateVersionRefInReadmodelCatalog.descriptorId,
            eserviceDescriptorInReadmodelCatalog.id
          )
        )
        .innerJoin(
          eserviceTemplateInReadmodelEserviceTemplate,
          eq(
            eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceInReadmodelCatalog.templateId
          )
        )
        .innerJoin(
          templateVersionUsed,
          and(
            eq(
              templateVersionUsed.id,
              eserviceDescriptorTemplateVersionRefInReadmodelCatalog.eserviceTemplateVersionId
            ),
            eq(
              templateVersionUsed.eserviceTemplateId,
              eserviceTemplateInReadmodelEserviceTemplate.id
            )
          )
        )
        .innerJoin(
          templateVersionNew,
          eq(
            templateVersionNew.eserviceTemplateId,
            eserviceTemplateInReadmodelEserviceTemplate.id
          )
        )
        .innerJoin(
          templateUsage,
          eq(
            templateUsage.templateId,
            eserviceTemplateInReadmodelEserviceTemplate.id
          )
        )
        .where(
          and(
            eq(eserviceInReadmodelCatalog.producerId, consumerId),
            eq(templateVersionNew.state, "Published"),
            gt(templateVersionNew.version, templateVersionUsed.version),
            gte(templateVersionNew.createdAt, dateThreshold.toISOString()),
            isNotNull(templateVersionNew.createdAt)
          )
        )
        .groupBy(
          eserviceTemplateInReadmodelEserviceTemplate.id,
          eserviceTemplateInReadmodelEserviceTemplate.name,
          eserviceTemplateInReadmodelEserviceTemplate.creatorId,
          templateUsage.templateUsageCount,
          templateVersionNew.id,
          templateVersionNew.createdAt
        )
        .orderBy(
          desc(templateUsage.templateUsageCount),
          asc(templateVersionNew.createdAt)
        );

      // Apply logic to select earliest version per template and limit to 5 templates
      const templateMap = new Map<string, (typeof results)[0]>();
      for (const row of results) {
        if (!templateMap.has(row.eserviceTemplateId)) {
          templateMap.set(row.eserviceTemplateId, row);
        }
      }
      const filteredResults = Array.from(templateMap.values()).slice(0, 5);

      logger.info(
        `Retrieved ${filteredResults.length} new e-service templates for consumer ${consumerId}`
      );

      return filteredResults.map((row) => ({
        eserviceTemplateId: row.eserviceTemplateId,
        eserviceTemplateVersionId: row.templateVersionId,
        eserviceTemplateName: row.eserviceTemplateName,
        eserviceTemplateProducerId: unsafeBrandId<TenantId>(
          row.eserviceTemplateProducerId
        ),
        totalCount: row.totalCount,
      }));
    },

    /**
     * Retrieves tenant names by their IDs in batch
     * can this be saved in our local DB for performance?
     */
    async getTenantsByIds(
      tenantIds: TenantId[]
    ): Promise<Map<TenantId, string>> {
      if (tenantIds.length === 0) {
        return new Map();
      }

      logger.info(`Retrieving ${tenantIds.length} tenants by IDs`);
      const tenants = await db
        .select({
          id: tenantInReadmodelTenant.id,
          name: tenantInReadmodelTenant.name,
        })
        .from(tenantInReadmodelTenant)
        .where(inArray(tenantInReadmodelTenant.id, tenantIds));

      return new Map(
        tenants.map((tenant) => [
          unsafeBrandId<TenantId>(tenant.id),
          tenant.name,
        ])
      );
    },

    /**
     * Returns verified assigned attributes for a tenant in the last DIGEST_FREQUENCY_DAYS days
     */
    async getVerifiedAssignedAttributes(
      tenantId: TenantId
    ): Promise<VerifiedAssignedAttribute[]> {
      logger.info(
        `Retrieving verified assigned attributes for tenant ${tenantId} since ${dateThreshold.toISOString()}`
      );

      const results = await db
        .select(
          withTotalCount({
            attributeName: attributeInReadmodelAttribute.name,
            verifierId:
              tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifierId,
          })
        )
        .from(tenantVerifiedAttributeVerifierInReadmodelTenant)
        .innerJoin(
          attributeInReadmodelAttribute,
          eq(
            tenantVerifiedAttributeVerifierInReadmodelTenant.tenantVerifiedAttributeId,
            attributeInReadmodelAttribute.id
          )
        )
        .where(
          and(
            eq(
              tenantVerifiedAttributeVerifierInReadmodelTenant.tenantId,
              tenantId
            ),
            gte(
              tenantVerifiedAttributeVerifierInReadmodelTenant.verificationDate,
              dateThreshold.toISOString()
            )
          )
        )
        .orderBy(
          asc(tenantVerifiedAttributeVerifierInReadmodelTenant.verificationDate)
        )
        .limit(5);

      logger.info(
        `Retrieved ${results.length} verified assigned attributes for tenant ${tenantId}`
      );

      return results.map((row) => ({
        attributeName: row.attributeName,
        state: "assigned" as const,
        actionPerformer: unsafeBrandId<TenantId>(row.verifierId),
        totalCount: row.totalCount,
      }));
    },

    /**
     * Returns verified revoked attributes for a tenant in the last DIGEST_FREQUENCY_DAYS days
     */
    async getVerifiedRevokedAttributes(
      tenantId: TenantId
    ): Promise<VerifiedRevokedAttribute[]> {
      logger.info(
        `Retrieving verified revoked attributes for tenant ${tenantId} since ${dateThreshold.toISOString()}`
      );

      const results = await db
        .select(
          withTotalCount({
            attributeName: attributeInReadmodelAttribute.name,
            revokerId:
              tenantVerifiedAttributeRevokerInReadmodelTenant.tenantRevokerId,
          })
        )
        .from(tenantVerifiedAttributeRevokerInReadmodelTenant)
        .innerJoin(
          attributeInReadmodelAttribute,
          eq(
            tenantVerifiedAttributeRevokerInReadmodelTenant.tenantVerifiedAttributeId,
            attributeInReadmodelAttribute.id
          )
        )
        .where(
          and(
            eq(
              tenantVerifiedAttributeRevokerInReadmodelTenant.tenantId,
              tenantId
            ),
            gte(
              tenantVerifiedAttributeRevokerInReadmodelTenant.revocationDate,
              dateThreshold.toISOString()
            )
          )
        )
        .orderBy(
          asc(tenantVerifiedAttributeRevokerInReadmodelTenant.revocationDate)
        )
        .limit(5);

      logger.info(
        `Retrieved ${results.length} verified revoked attributes for tenant ${tenantId}`
      );

      return results.map((row) => ({
        attributeName: row.attributeName,
        state: "revoked" as const,
        actionPerformer: unsafeBrandId<TenantId>(row.revokerId),
        totalCount: row.totalCount,
      }));
    },

    /**
     * Returns certified assigned attributes for a tenant in the last DIGEST_FREQUENCY_DAYS days.
     * Assigned: assignment_timestamp >= threshold AND revocation_timestamp IS NULL
     */
    async getCertifiedAssignedAttributes(
      tenantId: TenantId
    ): Promise<CertifiedAssignedAttribute[]> {
      logger.info(
        `Retrieving certified assigned attributes for tenant ${tenantId} since ${dateThreshold.toISOString()}`
      );

      const results = await db
        .select(
          withTotalCount({
            attributeName: attributeInReadmodelAttribute.name,
          })
        )
        .from(tenantCertifiedAttributeInReadmodelTenant)
        .innerJoin(
          attributeInReadmodelAttribute,
          eq(
            tenantCertifiedAttributeInReadmodelTenant.attributeId,
            attributeInReadmodelAttribute.id
          )
        )
        .where(
          and(
            eq(tenantCertifiedAttributeInReadmodelTenant.tenantId, tenantId),
            gte(
              tenantCertifiedAttributeInReadmodelTenant.assignmentTimestamp,
              dateThreshold.toISOString()
            ),
            isNull(
              tenantCertifiedAttributeInReadmodelTenant.revocationTimestamp
            )
          )
        )
        .limit(5);

      logger.info(
        `Retrieved ${results.length} certified assigned attributes for tenant ${tenantId}`
      );

      return results.map((row) => ({
        attributeName: row.attributeName,
        state: "assigned" as const,
        totalCount: row.totalCount,
      }));
    },

    /**
     * Returns certified revoked attributes for a tenant in the last DIGEST_FREQUENCY_DAYS days.
     * Revoked: revocation_timestamp >= threshold
     */
    async getCertifiedRevokedAttributes(
      tenantId: TenantId
    ): Promise<CertifiedRevokedAttribute[]> {
      logger.info(
        `Retrieving certified revoked attributes for tenant ${tenantId} since ${dateThreshold.toISOString()}`
      );

      const results = await db
        .select(
          withTotalCount({
            attributeName: attributeInReadmodelAttribute.name,
          })
        )
        .from(tenantCertifiedAttributeInReadmodelTenant)
        .innerJoin(
          attributeInReadmodelAttribute,
          eq(
            tenantCertifiedAttributeInReadmodelTenant.attributeId,
            attributeInReadmodelAttribute.id
          )
        )
        .where(
          and(
            eq(tenantCertifiedAttributeInReadmodelTenant.tenantId, tenantId),
            gte(
              tenantCertifiedAttributeInReadmodelTenant.revocationTimestamp,
              dateThreshold.toISOString()
            )
          )
        )
        .limit(5);

      logger.info(
        `Retrieved ${results.length} certified revoked attributes for tenant ${tenantId}`
      );

      return results.map((row) => ({
        attributeName: row.attributeName,
        state: "revoked" as const,
        totalCount: row.totalCount,
      }));
    },

    /**
     * Returns all users who have email notification preference set to "Digest"
     */
    async getUsersWithDigestPreference(): Promise<DigestUser[]> {
      const queryResult = await db
        .select({
          userId: userNotificationConfigInReadmodelNotificationConfig.userId,
          tenantId:
            userNotificationConfigInReadmodelNotificationConfig.tenantId,
          userRoles:
            userNotificationConfigInReadmodelNotificationConfig.userRoles,
        })
        .from(userNotificationConfigInReadmodelNotificationConfig)
        .where(
          eq(
            userNotificationConfigInReadmodelNotificationConfig.emailNotificationPreference,
            true
          )
        );

      return queryResult.map((row) => ({
        userId: unsafeBrandId<UserId>(row.userId),
        tenantId: unsafeBrandId<TenantId>(row.tenantId),
        userRoles: row.userRoles.map((r) => UserRole.parse(r)),
      }));
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
