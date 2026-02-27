import {
  eq,
  ne,
  desc,
  asc,
  and,
  or,
  gte,
  isNotNull,
  isNull,
  count,
  countDistinct,
  inArray,
  gt,
  sql,
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
  AgreementId,
  AgreementState,
  agreementState,
  PurposeId,
  PurposeVersionState,
  purposeVersionState,
  DelegationId,
  DelegationKind,
  DelegationState,
  delegationState,
} from "pagopa-interop-models";
import {
  DrizzleReturnType,
  userNotificationConfigInReadmodelNotificationConfig,
  eserviceDescriptorInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  eserviceDescriptorTemplateVersionRefInReadmodelCatalog,
  eserviceTemplateInReadmodelEserviceTemplate,
  eserviceTemplateVersionInReadmodelEserviceTemplate,
  tenantInReadmodelTenant,
  tenantVerifiedAttributeVerifierInReadmodelTenant,
  tenantVerifiedAttributeRevokerInReadmodelTenant,
  tenantCertifiedAttributeInReadmodelTenant,
  attributeInReadmodelAttribute,
  purposeInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  delegationInReadmodelDelegation,
  delegationStampInReadmodelDelegation,
} from "pagopa-interop-readmodel-models";
import { config } from "../config/config.js";

const SECTION_LIST_LIMIT = 5;

export type DigestUser = {
  userId: UserId;
  tenantId: TenantId;
  userRoles: UserRole[];
};

export type TenantData = {
  name: string;
  selfcareId: string | null;
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

// Base type for agreement data shared between sent and received agreements
type BaseAgreement = {
  agreementId: AgreementId;
  eserviceId: EServiceId;
  consumerId: TenantId;
  producerId: TenantId;
  actionDate: string;
  totalCount: number;
};

export type SentAgreement = BaseAgreement & {
  state: AgreementState;
};

export type ReceivedAgreement = BaseAgreement;

type BaseDelegation = {
  delegationId: DelegationId;
  eserviceId: EServiceId;
  delegationName: string;
  delegationKind: DelegationKind;
  actionDate: string;
  totalCount: number;
};

export type SentDelegation = BaseDelegation & {
  state: DelegationState;
  delegateId: TenantId;
};

export type ReceivedDelegation = BaseDelegation & {
  state: DelegationState;
  delegatorId: TenantId;
};

export type PopularEserviceTemplate = {
  eserviceTemplateId: string;
  eserviceTemplateVersionId: string;
  eserviceTemplateName: string;
  eserviceTemplateCreatorId: TenantId;
  instances: number;
  totalCount: number;
};

// Base type for purpose data shared between sent and received purposes
type BasePurpose = {
  purposeId: PurposeId;
  purposeTitle: string;
  consumerId: TenantId;
  actionDate: string;
  totalCount: number;
};

// Sent purposes: Active, Rejected, WaitingForApproval states
export type SentPurposeState =
  | typeof purposeVersionState.active
  | typeof purposeVersionState.rejected
  | typeof purposeVersionState.waitingForApproval;

export type SentPurpose = BasePurpose & {
  state: SentPurposeState;
};

// Received purposes: Active, WaitingForApproval states, includes consumerName
export type ReceivedPurposeState =
  | typeof purposeVersionState.active
  | typeof purposeVersionState.waitingForApproval;

export type ReceivedPurpose = BasePurpose & {
  state: ReceivedPurposeState;
  consumerName: string;
};

/**
 * Raw purpose query result base type
 */
type BasePurposeQueryResult = {
  purposeId: string;
  purposeTitle: string;
  consumerId: string;
  state: string;
  updatedAt: string | null;
  createdAt: string;
};

/**
 * Raw purpose query result type for received purposes (includes consumer name from join)
 */
type ReceivedPurposeQueryResult = BasePurposeQueryResult & {
  consumerName: string;
};

type DelegationQueryResult<T extends string = string> = {
  delegationId: string;
  eserviceId: string;
  delegationName: string;
  state: string;
  kind: string;
  actionDate: string;
  counterpartyId: T;
};

/**
 * Groups delegation query results by state, limits to SECTION_LIST_LIMIT per state,
 * and maps to the output format with totalCount per state.
 */
function processDelegationResults<T extends string>(
  results: Array<DelegationQueryResult<T>>,
  sectionLimit: number
): Array<
  BaseDelegation & { state: DelegationState; counterpartyId: TenantId }
> {
  // Group by state
  const groupedByState = new Map<string, Array<DelegationQueryResult<T>>>();
  for (const row of results) {
    const stateResults = groupedByState.get(row.state) ?? [];
    groupedByState.set(row.state, [...stateResults, row]);
  }

  // Build final results with totalCount per state and limit per state
  return Array.from(groupedByState.entries()).flatMap(
    ([state, stateResults]) => {
      const totalCount = stateResults.length;
      return stateResults.slice(0, sectionLimit).map((row) => ({
        delegationId: unsafeBrandId<DelegationId>(row.delegationId),
        eserviceId: unsafeBrandId<EServiceId>(row.eserviceId),
        delegationName: row.delegationName,
        state: DelegationState.parse(state),
        delegationKind: DelegationKind.parse(row.kind),
        actionDate: row.actionDate,
        counterpartyId: unsafeBrandId<TenantId>(row.counterpartyId),
        totalCount,
      }));
    }
  );
}

/**
 * Generic helper to retrieve entities with request-scoped caching.
 * Avoids duplicate DB lookups by checking the cache first.
 */
async function getCachedEntities<K, V>(
  ids: K[],
  cache: Map<K, V>,
  fetchFn: (uncachedIds: K[]) => Promise<Map<K, V>>,
  logger: Logger,
  entityName: string
): Promise<Map<K, V>> {
  if (ids.length === 0) {
    return new Map();
  }

  const uncachedIds = ids.filter((id) => !cache.has(id));

  const cachedEntries: Array<[K, V]> = ids
    .filter((id) => cache.has(id))
    .map((id) => [id, cache.get(id) as V]);

  if (uncachedIds.length > 0) {
    logger.info(
      `Retrieving ${uncachedIds.length} ${entityName} by IDs (${
        ids.length - uncachedIds.length
      } from cache)`
    );
    const fetched = await fetchFn(uncachedIds);

    fetched.forEach((value, key) => {
      cache.set(key, value);
    });

    return new Map([...cachedEntries, ...fetched.entries()]);
  } else {
    logger.info(
      `Retrieved ${ids.length} ${entityName} from cache (no DB query needed)`
    );
  }

  return new Map(cachedEntries);
}

/**
 * Groups purpose query results by state, limits to SECTION_LIST_LIMIT per state,
 * and maps each row using the provided mapper function.
 */
function groupAndMapPurposeResults<
  TInput extends BasePurposeQueryResult,
  TOutput
>(
  results: TInput[],
  mapRow: (row: TInput, state: string, totalCount: number) => TOutput
): TOutput[] {
  const groupedByState = results.reduce((acc, row) => {
    const stateResults = acc.get(row.state) ?? [];
    acc.set(row.state, [...stateResults, row]);
    return acc;
  }, new Map<string, TInput[]>());

  return Array.from(groupedByState.entries()).flatMap(
    ([state, stateResults]) => {
      const totalCount = stateResults.length;
      return stateResults
        .slice(0, SECTION_LIST_LIMIT)
        .map((row) => mapRow(row, state, totalCount));
    }
  );
}

function groupAndMapSentPurposeResults(
  results: BasePurposeQueryResult[]
): SentPurpose[] {
  return groupAndMapPurposeResults(results, (row, state, totalCount) => ({
    purposeId: unsafeBrandId<PurposeId>(row.purposeId),
    purposeTitle: row.purposeTitle,
    consumerId: unsafeBrandId<TenantId>(row.consumerId),
    state: PurposeVersionState.parse(state) as SentPurposeState,
    actionDate: row.updatedAt ?? row.createdAt,
    totalCount,
  }));
}

function groupAndMapReceivedPurposeResults(
  results: ReceivedPurposeQueryResult[]
): ReceivedPurpose[] {
  return groupAndMapPurposeResults(results, (row, state, totalCount) => ({
    purposeId: unsafeBrandId<PurposeId>(row.purposeId),
    purposeTitle: row.purposeTitle,
    consumerId: unsafeBrandId<TenantId>(row.consumerId),
    consumerName: row.consumerName,
    state: PurposeVersionState.parse(state) as ReceivedPurposeState,
    actionDate: row.updatedAt ?? row.createdAt,
    totalCount,
  }));
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(db: DrizzleReturnType, logger: Logger) {
  const dateThreshold = new Date();
  dateThreshold.setHours(
    dateThreshold.getHours() - config.digestFrequencyHours
  );

  // Request-scoped caches to avoid duplicate DB lookups for the same IDs
  // These caches live for the lifetime of the service instance (job duration)
  const tenantDataCache = new Map<TenantId, TenantData>();
  const eserviceNameCache = new Map<EServiceId, string>();

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
        .limit(SECTION_LIST_LIMIT);

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
        .slice(0, SECTION_LIST_LIMIT);

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
      const filteredResults = Array.from(templateMap.values()).slice(
        0,
        SECTION_LIST_LIMIT
      );

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
     * Returns the top eservice templates by the creator that have instances
     * (eservices) created in the last 7 days with published descriptors.
     * Returns the latest published template version for each template.
     */
    async getPopularEserviceTemplates(
      creatorId: TenantId
    ): Promise<PopularEserviceTemplate[]> {
      logger.info(
        `Retrieving popular eservice templates for creator ${creatorId} since ${dateThreshold.toISOString()}`
      );

      // Alias for the subquery to get the latest published template version
      const latestVersionSubquery = alias(
        eserviceTemplateVersionInReadmodelEserviceTemplate,
        "latest_version_subquery"
      );

      const results = await db
        .select(
          withTotalCount({
            eserviceTemplateId: eserviceTemplateInReadmodelEserviceTemplate.id,
            eserviceTemplateVersionId:
              eserviceTemplateVersionInReadmodelEserviceTemplate.id,
            eserviceTemplateName:
              eserviceTemplateInReadmodelEserviceTemplate.name,
            eserviceTemplateCreatorId:
              eserviceTemplateInReadmodelEserviceTemplate.creatorId,
            instances: countDistinct(eserviceInReadmodelCatalog.id).as(
              "instances"
            ),
          })
        )
        .from(eserviceTemplateInReadmodelEserviceTemplate)
        .innerJoin(
          eserviceInReadmodelCatalog,
          and(
            eq(
              eserviceTemplateInReadmodelEserviceTemplate.id,
              eserviceInReadmodelCatalog.templateId
            ),
            gte(
              eserviceInReadmodelCatalog.createdAt,
              dateThreshold.toISOString()
            )
          )
        )
        .innerJoin(
          eserviceDescriptorInReadmodelCatalog,
          and(
            eq(
              eserviceInReadmodelCatalog.id,
              eserviceDescriptorInReadmodelCatalog.eserviceId
            ),
            eq(eserviceDescriptorInReadmodelCatalog.state, "Published")
          )
        )
        .innerJoin(
          eserviceTemplateVersionInReadmodelEserviceTemplate,
          and(
            eq(
              eserviceTemplateVersionInReadmodelEserviceTemplate.eserviceTemplateId,
              eserviceTemplateInReadmodelEserviceTemplate.id
            ),
            eq(
              eserviceTemplateVersionInReadmodelEserviceTemplate.state,
              "Published"
            ),
            eq(
              eserviceTemplateVersionInReadmodelEserviceTemplate.id,
              db
                .select({ id: latestVersionSubquery.id })
                .from(latestVersionSubquery)
                .where(
                  and(
                    eq(
                      latestVersionSubquery.eserviceTemplateId,
                      eserviceTemplateInReadmodelEserviceTemplate.id
                    ),
                    eq(latestVersionSubquery.state, "Published")
                  )
                )
                .orderBy(desc(latestVersionSubquery.version))
                .limit(1)
            )
          )
        )
        .where(
          eq(eserviceTemplateInReadmodelEserviceTemplate.creatorId, creatorId)
        )
        .groupBy(
          eserviceTemplateInReadmodelEserviceTemplate.id,
          eserviceTemplateVersionInReadmodelEserviceTemplate.id,
          eserviceTemplateInReadmodelEserviceTemplate.name,
          eserviceTemplateInReadmodelEserviceTemplate.creatorId
        )
        .orderBy(desc(countDistinct(eserviceInReadmodelCatalog.id)))
        .limit(5);

      logger.info(
        `Retrieved ${results.length} popular eservice templates for creator ${creatorId}`
      );

      return results.map((row) => ({
        eserviceTemplateId: row.eserviceTemplateId,
        eserviceTemplateVersionId: row.eserviceTemplateVersionId,
        eserviceTemplateName: row.eserviceTemplateName,
        eserviceTemplateCreatorId: unsafeBrandId<TenantId>(
          row.eserviceTemplateCreatorId
        ),
        instances: row.instances,
        totalCount: row.totalCount,
      }));
    },

    /**
     * Returns agreements sent by the consumer tenant that changed to Active, Rejected, or Suspended.
     * Uses the appropriate stamp for each state's action date:
     * - Active → activation stamp
     * - Rejected → rejection stamp
     * - Suspended → suspensionByProducer stamp
     * Limited to 5 per state.
     */
    async getSentAgreements(consumerId: TenantId): Promise<SentAgreement[]> {
      logger.info(
        `Retrieving sent agreements for consumer ${consumerId} since ${dateThreshold.toISOString()}`
      );

      // Single query fetching all three states with their corresponding stamp kinds
      const results = await db
        .select({
          agreementId: agreementInReadmodelAgreement.id,
          eserviceId: agreementInReadmodelAgreement.eserviceId,
          consumerId: agreementInReadmodelAgreement.consumerId,
          producerId: agreementInReadmodelAgreement.producerId,
          state: agreementInReadmodelAgreement.state,
          actionDate: agreementStampInReadmodelAgreement.when,
        })
        .from(agreementInReadmodelAgreement)
        .innerJoin(
          agreementStampInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementStampInReadmodelAgreement.agreementId
          )
        )
        .where(
          and(
            eq(agreementInReadmodelAgreement.consumerId, consumerId),
            gte(
              agreementStampInReadmodelAgreement.when,
              dateThreshold.toISOString()
            ),
            or(
              and(
                eq(agreementInReadmodelAgreement.state, agreementState.active),
                eq(agreementStampInReadmodelAgreement.kind, "activation")
              ),
              and(
                eq(
                  agreementInReadmodelAgreement.state,
                  agreementState.rejected
                ),
                eq(agreementStampInReadmodelAgreement.kind, "rejection")
              ),
              and(
                eq(
                  agreementInReadmodelAgreement.state,
                  agreementState.suspended
                ),
                eq(
                  agreementStampInReadmodelAgreement.kind,
                  "suspensionByProducer"
                )
              )
            )
          )
        )
        .orderBy(asc(agreementStampInReadmodelAgreement.when));

      // Group by state using reduce (functional approach)
      const groupedByState = results.reduce((acc, row) => {
        const stateResults = acc.get(row.state) ?? [];
        return new Map(acc).set(row.state, [...stateResults, row]);
      }, new Map<string, typeof results>());

      // Build final results with totalCount per state and limit to 5 per state
      const allResults = Array.from(groupedByState.entries()).flatMap(
        ([state, stateResults]) => {
          const totalCount = stateResults.length;
          return stateResults.slice(0, SECTION_LIST_LIMIT).map((row) => ({
            agreementId: unsafeBrandId<AgreementId>(row.agreementId),
            eserviceId: unsafeBrandId<EServiceId>(row.eserviceId),
            consumerId: unsafeBrandId<TenantId>(row.consumerId),
            producerId: unsafeBrandId<TenantId>(row.producerId),
            state: AgreementState.parse(state),
            actionDate: row.actionDate,
            totalCount,
          }));
        }
      );

      logger.info(
        `Retrieved ${allResults.length} sent agreements for consumer ${consumerId} (up to ${SECTION_LIST_LIMIT} per state)`
      );

      return allResults;
    },

    /**
     * Returns agreements received by the producer tenant that are waiting for approval (Pending state).
     * Uses the submission stamp for the action date.
     * Limited to 5 results.
     */
    async getReceivedAgreements(
      producerId: TenantId
    ): Promise<ReceivedAgreement[]> {
      logger.info(
        `Retrieving received agreements for producer ${producerId} since ${dateThreshold.toISOString()}`
      );

      const results = await db
        .select({
          agreementId: agreementInReadmodelAgreement.id,
          eserviceId: agreementInReadmodelAgreement.eserviceId,
          consumerId: agreementInReadmodelAgreement.consumerId,
          producerId: agreementInReadmodelAgreement.producerId,
          actionDate: agreementStampInReadmodelAgreement.when,
        })
        .from(agreementInReadmodelAgreement)
        .innerJoin(
          agreementStampInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementStampInReadmodelAgreement.agreementId
          )
        )
        .where(
          and(
            eq(agreementInReadmodelAgreement.producerId, producerId),
            eq(agreementStampInReadmodelAgreement.kind, "submission"),
            eq(agreementInReadmodelAgreement.state, agreementState.pending),
            gte(
              agreementStampInReadmodelAgreement.when,
              dateThreshold.toISOString()
            )
          )
        )
        .orderBy(asc(agreementStampInReadmodelAgreement.when));

      const totalCount = results.length;

      logger.info(
        `Retrieved ${results.length} received agreements for tenant ${producerId}`
      );

      return results.slice(0, SECTION_LIST_LIMIT).map((row) => ({
        agreementId: unsafeBrandId<AgreementId>(row.agreementId),
        eserviceId: unsafeBrandId<EServiceId>(row.eserviceId),
        consumerId: unsafeBrandId<TenantId>(row.consumerId),
        producerId: unsafeBrandId<TenantId>(row.producerId),
        actionDate: row.actionDate,
        totalCount,
      }));
    },

    /**
     * Returns delegations sent by the delegator tenant that changed to Active or Rejected.
     * Uses the appropriate stamp for each state's action date:
     * - Active → activation stamp
     * - Rejected → rejection stamp
     * Limited to 5 per state.
     */
    async getSentDelegations(delegatorId: TenantId): Promise<SentDelegation[]> {
      logger.info(
        `Retrieving sent delegations for delegator ${delegatorId} since ${dateThreshold.toISOString()}`
      );

      const results = await db
        .select({
          delegationId: delegationInReadmodelDelegation.id,
          eserviceId: delegationInReadmodelDelegation.eserviceId,
          delegationName: eserviceInReadmodelCatalog.name,
          state: delegationInReadmodelDelegation.state,
          kind: delegationInReadmodelDelegation.kind,
          actionDate: delegationStampInReadmodelDelegation.when,
          counterpartyId: delegationInReadmodelDelegation.delegateId,
        })
        .from(delegationInReadmodelDelegation)
        .innerJoin(
          eserviceInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            delegationInReadmodelDelegation.eserviceId
          )
        )
        .innerJoin(
          delegationStampInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationStampInReadmodelDelegation.delegationId
          )
        )
        .where(
          and(
            eq(delegationInReadmodelDelegation.delegatorId, delegatorId),
            or(
              and(
                eq(
                  delegationInReadmodelDelegation.state,
                  delegationState.active
                ),
                eq(delegationStampInReadmodelDelegation.kind, "activation")
              ),
              and(
                eq(
                  delegationInReadmodelDelegation.state,
                  delegationState.rejected
                ),
                eq(delegationStampInReadmodelDelegation.kind, "rejection")
              )
            ),
            gte(
              delegationStampInReadmodelDelegation.when,
              dateThreshold.toISOString()
            )
          )
        )
        .orderBy(asc(delegationStampInReadmodelDelegation.when));

      const processedResults = processDelegationResults(
        results,
        SECTION_LIST_LIMIT
      );

      logger.info(
        `Retrieved ${processedResults.length} sent delegations for delegator ${delegatorId} (up to ${SECTION_LIST_LIMIT} per state)`
      );

      return processedResults.map((r) => ({
        delegationId: r.delegationId,
        eserviceId: r.eserviceId,
        delegationName: r.delegationName,
        state: r.state,
        delegationKind: r.delegationKind,
        actionDate: r.actionDate,
        totalCount: r.totalCount,
        delegateId: r.counterpartyId,
      }));
    },

    /**
     * Returns delegations received by the delegate tenant that are waiting for approval or revoked.
     * Uses the appropriate stamp for each state's action date:
     * - WaitingForApproval → submission stamp
     * - Revoked → revocation stamp
     * Limited to 5 per state.
     */
    async getReceivedDelegations(
      delegateId: TenantId
    ): Promise<ReceivedDelegation[]> {
      logger.info(
        `Retrieving received delegations for delegate ${delegateId} since ${dateThreshold.toISOString()}`
      );

      const results = await db
        .select({
          delegationId: delegationInReadmodelDelegation.id,
          eserviceId: delegationInReadmodelDelegation.eserviceId,
          delegationName: eserviceInReadmodelCatalog.name,
          state: delegationInReadmodelDelegation.state,
          kind: delegationInReadmodelDelegation.kind,
          actionDate: delegationStampInReadmodelDelegation.when,
          counterpartyId: delegationInReadmodelDelegation.delegatorId,
        })
        .from(delegationInReadmodelDelegation)
        .innerJoin(
          eserviceInReadmodelCatalog,
          eq(
            eserviceInReadmodelCatalog.id,
            delegationInReadmodelDelegation.eserviceId
          )
        )
        .innerJoin(
          delegationStampInReadmodelDelegation,
          eq(
            delegationInReadmodelDelegation.id,
            delegationStampInReadmodelDelegation.delegationId
          )
        )
        .where(
          and(
            eq(delegationInReadmodelDelegation.delegateId, delegateId),
            or(
              and(
                eq(
                  delegationInReadmodelDelegation.state,
                  delegationState.waitingForApproval
                ),
                eq(delegationStampInReadmodelDelegation.kind, "submission")
              ),
              and(
                eq(
                  delegationInReadmodelDelegation.state,
                  delegationState.revoked
                ),
                eq(delegationStampInReadmodelDelegation.kind, "revocation")
              )
            ),
            gte(
              delegationStampInReadmodelDelegation.when,
              dateThreshold.toISOString()
            )
          )
        )
        .orderBy(asc(delegationStampInReadmodelDelegation.when));

      const processedResults = processDelegationResults(
        results,
        SECTION_LIST_LIMIT
      );

      logger.info(
        `Retrieved ${processedResults.length} received delegations for delegate ${delegateId} (up to ${SECTION_LIST_LIMIT} per state)`
      );

      return processedResults.map((r) => ({
        delegationId: r.delegationId,
        eserviceId: r.eserviceId,
        delegationName: r.delegationName,
        state: r.state,
        delegationKind: r.delegationKind,
        actionDate: r.actionDate,
        totalCount: r.totalCount,
        delegatorId: r.counterpartyId,
      }));
    },

    /**
     * Retrieves tenant data (name and selfcareId) by their IDs in batch.
     * Uses request-scoped caching to avoid duplicate lookups.
     */
    async getTenantsByIds(
      tenantIds: TenantId[]
    ): Promise<Map<TenantId, TenantData>> {
      return getCachedEntities(
        tenantIds,
        tenantDataCache,
        async (uncachedIds) => {
          const tenants = await db
            .select({
              id: tenantInReadmodelTenant.id,
              name: tenantInReadmodelTenant.name,
              selfcareId: tenantInReadmodelTenant.selfcareId,
            })
            .from(tenantInReadmodelTenant)
            .where(inArray(tenantInReadmodelTenant.id, uncachedIds));

          return new Map(
            tenants.map((tenant) => [
              unsafeBrandId<TenantId>(tenant.id),
              { name: tenant.name, selfcareId: tenant.selfcareId },
            ])
          );
        },
        logger,
        "tenant data"
      );
    },

    /**
     * Returns verified assigned attributes for a tenant in the last configured frequency hours
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
     * Returns verified revoked attributes for a tenant in the last configured frequency hours
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
     * Returns certified assigned attributes for a tenant in the last configured frequency hours.
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
     * Returns certified revoked attributes for a tenant in the last configured frequency hours.
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
     * Retrieves e-service names by their IDs in batch.
     * Uses request-scoped caching to avoid duplicate lookups.
     */
    async getEServicesByIds(
      eserviceIds: EServiceId[]
    ): Promise<Map<EServiceId, string>> {
      return getCachedEntities(
        eserviceIds,
        eserviceNameCache,
        async (uncachedIds) => {
          const eservices = await db
            .select({
              id: eserviceInReadmodelCatalog.id,
              name: eserviceInReadmodelCatalog.name,
            })
            .from(eserviceInReadmodelCatalog)
            .where(inArray(eserviceInReadmodelCatalog.id, uncachedIds));

          return new Map(
            eservices.map((eservice) => [
              unsafeBrandId<EServiceId>(eservice.id),
              eservice.name,
            ])
          );
        },
        logger,
        "e-services"
      );
    },

    /**
     * Returns purposes sent by the consumer tenant that changed to Active, Rejected, or WaitingForApproval.
     * Limited to 5 per state.
     */
    async getSentPurposes(consumerId: TenantId): Promise<SentPurpose[]> {
      logger.info(
        `Retrieving sent purposes for consumer ${consumerId} since ${dateThreshold.toISOString()}`
      );

      const results = await db
        .selectDistinctOn([purposeInReadmodelPurpose.id], {
          purposeId: purposeInReadmodelPurpose.id,
          purposeTitle: purposeInReadmodelPurpose.title,
          consumerId: purposeInReadmodelPurpose.consumerId,
          state: purposeVersionInReadmodelPurpose.state,
          updatedAt: purposeVersionInReadmodelPurpose.updatedAt,
          createdAt: purposeVersionInReadmodelPurpose.createdAt,
        })
        .from(purposeInReadmodelPurpose)
        .innerJoin(
          purposeVersionInReadmodelPurpose,
          and(
            eq(
              purposeInReadmodelPurpose.id,
              purposeVersionInReadmodelPurpose.purposeId
            ),
            eq(
              purposeInReadmodelPurpose.metadataVersion,
              purposeVersionInReadmodelPurpose.metadataVersion
            )
          )
        )
        .where(
          and(
            eq(purposeInReadmodelPurpose.consumerId, consumerId),
            or(
              gte(
                purposeVersionInReadmodelPurpose.updatedAt,
                dateThreshold.toISOString()
              ),
              and(
                isNull(purposeVersionInReadmodelPurpose.updatedAt),
                gte(
                  purposeVersionInReadmodelPurpose.createdAt,
                  dateThreshold.toISOString()
                )
              )
            ),
            or(
              eq(
                purposeVersionInReadmodelPurpose.state,
                purposeVersionState.active
              ),
              eq(
                purposeVersionInReadmodelPurpose.state,
                purposeVersionState.rejected
              ),
              eq(
                purposeVersionInReadmodelPurpose.state,
                purposeVersionState.waitingForApproval
              )
            )
          )
        )
        .orderBy(
          purposeInReadmodelPurpose.id,
          asc(
            sql`COALESCE(${purposeVersionInReadmodelPurpose.updatedAt}, ${purposeVersionInReadmodelPurpose.createdAt})`
          )
        );

      const allResults = groupAndMapSentPurposeResults(results);

      logger.info(
        `Retrieved ${allResults.length} sent purposes for consumer ${consumerId} (up to ${SECTION_LIST_LIMIT} per state)`
      );

      return allResults;
    },

    /**
     * Returns purposes received by the producer tenant (via e-service ownership)
     * that are in Active or WaitingForApproval state.
     * Excludes purposes where the tenant is also the consumer (to avoid duplicates).
     * Includes consumer name via join with tenant table.
     * Limited to 5 per state.
     */
    async getReceivedPurposes(
      producerId: TenantId
    ): Promise<ReceivedPurpose[]> {
      logger.info(
        `Retrieving received purposes for producer ${producerId} since ${dateThreshold.toISOString()}`
      );

      const results = await db
        .selectDistinctOn([purposeInReadmodelPurpose.id], {
          purposeId: purposeInReadmodelPurpose.id,
          purposeTitle: purposeInReadmodelPurpose.title,
          consumerId: purposeInReadmodelPurpose.consumerId,
          consumerName: tenantInReadmodelTenant.name,
          state: purposeVersionInReadmodelPurpose.state,
          updatedAt: purposeVersionInReadmodelPurpose.updatedAt,
          createdAt: purposeVersionInReadmodelPurpose.createdAt,
        })
        .from(purposeInReadmodelPurpose)
        .innerJoin(
          purposeVersionInReadmodelPurpose,
          and(
            eq(
              purposeInReadmodelPurpose.id,
              purposeVersionInReadmodelPurpose.purposeId
            ),
            eq(
              purposeInReadmodelPurpose.metadataVersion,
              purposeVersionInReadmodelPurpose.metadataVersion
            )
          )
        )
        .innerJoin(
          eserviceInReadmodelCatalog,
          eq(
            purposeInReadmodelPurpose.eserviceId,
            eserviceInReadmodelCatalog.id
          )
        )
        .innerJoin(
          tenantInReadmodelTenant,
          eq(purposeInReadmodelPurpose.consumerId, tenantInReadmodelTenant.id)
        )
        .where(
          and(
            eq(eserviceInReadmodelCatalog.producerId, producerId),
            // Exclude purposes where tenant is also the consumer (avoid duplicates)
            ne(purposeInReadmodelPurpose.consumerId, producerId),
            or(
              gte(
                purposeVersionInReadmodelPurpose.updatedAt,
                dateThreshold.toISOString()
              ),
              and(
                isNull(purposeVersionInReadmodelPurpose.updatedAt),
                gte(
                  purposeVersionInReadmodelPurpose.createdAt,
                  dateThreshold.toISOString()
                )
              )
            ),
            or(
              eq(
                purposeVersionInReadmodelPurpose.state,
                purposeVersionState.active
              ),
              eq(
                purposeVersionInReadmodelPurpose.state,
                purposeVersionState.waitingForApproval
              )
            )
          )
        )
        .orderBy(
          purposeInReadmodelPurpose.id,
          asc(
            sql`COALESCE(${purposeVersionInReadmodelPurpose.updatedAt}, ${purposeVersionInReadmodelPurpose.createdAt})`
          )
        );

      const allResults = groupAndMapReceivedPurposeResults(results);

      logger.info(
        `Retrieved ${allResults.length} received purposes for producer ${producerId} (up to ${SECTION_LIST_LIMIT} per state)`
      );

      return allResults;
    },

    /**
     * Retrieves the latest published descriptor ID for each e-service.
     * Returns a map of eserviceId to descriptorId.
     */
    async getLatestPublishedDescriptorIds(
      eserviceIds: EServiceId[]
    ): Promise<Map<EServiceId, DescriptorId>> {
      if (eserviceIds.length === 0) {
        return new Map();
      }

      logger.info(
        `Retrieving latest published descriptor IDs for ${eserviceIds.length} e-services`
      );

      const results = await db
        .select({
          eserviceId: eserviceDescriptorInReadmodelCatalog.eserviceId,
          descriptorId: eserviceDescriptorInReadmodelCatalog.id,
          version: eserviceDescriptorInReadmodelCatalog.version,
        })
        .from(eserviceDescriptorInReadmodelCatalog)
        .where(
          and(
            inArray(
              eserviceDescriptorInReadmodelCatalog.eserviceId,
              eserviceIds
            ),
            eq(eserviceDescriptorInReadmodelCatalog.state, "Published")
          )
        )
        .orderBy(desc(eserviceDescriptorInReadmodelCatalog.version));

      // Group by eserviceId and take the highest version (first in ordered results)
      const descriptorMap = new Map<EServiceId, DescriptorId>();
      for (const row of results) {
        const eserviceId = unsafeBrandId<EServiceId>(row.eserviceId);
        if (!descriptorMap.has(eserviceId)) {
          descriptorMap.set(
            eserviceId,
            unsafeBrandId<DescriptorId>(row.descriptorId)
          );
        }
      }

      return descriptorMap;
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
            userNotificationConfigInReadmodelNotificationConfig.emailDigestPreference,
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
