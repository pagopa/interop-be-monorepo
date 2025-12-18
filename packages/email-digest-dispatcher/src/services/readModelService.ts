import {
  eq,
  desc,
  asc,
  and,
  gte,
  isNotNull,
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
