import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  notExists,
  or,
  sql,
  SQL,
  Column,
} from "drizzle-orm";
import { alias, PgSelect } from "drizzle-orm/pg-core";
import {
  ascLower,
  createListResult,
  escapeSqlLike,
  ilikeEscaped,
  withTotalCount,
} from "pagopa-interop-commons";
import {
  EService,
  WithMetadata,
  EServiceId,
  DescriptorId,
  TenantId,
  Tenant,
  Purpose,
  PurposeId,
  ListResult,
  purposeVersionState,
  Agreement,
  agreementState,
  PurposeVersionState,
  delegationState,
  Delegation,
  delegationKind,
  DelegationId,
  PurposeTemplateId,
  PurposeTemplate,
  purposeTemplateState,
  ClientId,
  Client,
  UserId,
  RiskAnalysisSigningState,
  riskAnalysisSigningState,
  TenantKind,
  unsafeBrandId,
  descriptorState,
  DescriptorState,
} from "pagopa-interop-models";
import {
  aggregatePurposeArray,
  AgreementReadModelService,
  CatalogReadModelService,
  ClientReadModelService,
  DelegationReadModelService,
  PurposeReadModelService,
  PurposeTemplateReadModelService,
  TenantReadModelService,
  toPurposeAggregatorArray,
} from "pagopa-interop-readmodel";
import {
  agreementInReadmodelAgreement,
  delegationInReadmodelDelegation,
  DrizzleReturnType,
  eserviceInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  purposeInReadmodelPurpose,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  purposeRiskAnalysisFormInReadmodelPurpose,
  riskAnalysisReviewerInReadmodelPurpose,
  purposeTemplateInReadmodelPurposeTemplate,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
  purposeVersionSignedDocumentInReadmodelPurpose,
  purposeVersionStampInReadmodelPurpose,
  tenantInReadmodelTenant,
  tenantCertifiedAttributeInReadmodelTenant,
  tenantCertifiedDiscreteAttributeInReadmodelTenant,
} from "pagopa-interop-readmodel-models";
import { tenantKindHistory } from "pagopa-interop-tenant-kind-history-db-models";
import { match } from "ts-pattern";

import { CustomizedQuotaRule } from "./customizedQuotaRules.js";

export const producerDashboardNearThresholdPercentage = 90;

export type GetPurposesFilters = {
  title?: string;
  eservicesIds: EServiceId[];
  consumersIds: TenantId[];
  producersIds: TenantId[];
  purposesIds: PurposeId[];
  states: PurposeVersionState[];
  excludeDraft: boolean | undefined;
  reviewerId?: UserId;
  signingStates?: RiskAnalysisSigningState[];
  sortByRiskAnalysisAssignmentDateDescending?: boolean;
};

const activeProducerDelegations = alias(
  delegationInReadmodelDelegation,
  "activeProducerDelegations"
);
const activeConsumerDelegations = alias(
  delegationInReadmodelDelegation,
  "activeConsumerDelegations"
);

// Aggregation rule of the descriptor load, shared by the per-descriptor
// queries and the producer dashboard batch (GROUP BY) query:
// - the agreement of the purpose consumer must be Active or Suspended;
// - the approved load is made of the Active purpose versions;
// - the load waiting for approval is made of the WaitingForApproval versions.
const approvedLoadVersionState = purposeVersionState.active;
const waitingForApprovalLoadVersionState =
  purposeVersionState.waitingForApproval;

const purposeAgreementLoadCondition = (): SQL | undefined =>
  and(
    eq(
      agreementInReadmodelAgreement.eserviceId,
      purposeInReadmodelPurpose.eserviceId
    ),
    eq(
      agreementInReadmodelAgreement.consumerId,
      purposeInReadmodelPurpose.consumerId
    ),
    inArray(agreementInReadmodelAgreement.state, [
      agreementState.active,
      agreementState.suspended,
    ])
  );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const addActiveVersionsDailyCallsJoinsAndFilters = <T extends PgSelect>(
  query: T,
  eserviceId: EServiceId,
  descriptorId: DescriptorId
) =>
  query
    .innerJoin(
      purposeVersionInReadmodelPurpose,
      eq(
        purposeVersionInReadmodelPurpose.purposeId,
        purposeInReadmodelPurpose.id
      )
    )
    .innerJoin(agreementInReadmodelAgreement, purposeAgreementLoadCondition())
    .where(
      and(
        eq(purposeInReadmodelPurpose.eserviceId, eserviceId),
        eq(agreementInReadmodelAgreement.descriptorId, descriptorId),
        eq(purposeVersionInReadmodelPurpose.state, approvedLoadVersionState)
      )
    );

export const producerDashboardDescriptorStates: DescriptorState[] = [
  descriptorState.published,
  descriptorState.deprecated,
  descriptorState.suspended,
  descriptorState.archiving,
  descriptorState.archivingSuspended,
];

type SaturationSortBy =
  | "PERCENTAGE_DESC"
  | "PERCENTAGE_ASC"
  | "NAME_ASC"
  | "NAME_DESC";

type ProducerDashboardSaturationRow = {
  eserviceId: EServiceId;
  eserviceName: string;
  descriptorId: DescriptorId;
  version: string;
  activePurposesCount: number;
  approvedDailyCalls: number;
  dailyCallsTotal: number;
  waitingForApprovalDailyCalls: number;
};

type ProducerDashboardSaturationResult = {
  results: ProducerDashboardSaturationRow[];
  totalCount: number;
  summary: { overThreshold: number; nearThreshold: number; total: number };
};

type ProducerEServiceMonitoringSaturationConsumer = {
  consumerId: TenantId;
  consumerName: string;
  consumerKind: TenantKind | undefined;
  activePurposesCount: number;
  approvedDailyCalls: number;
  waitingForApprovalDailyCalls: number;
  dailyCallsPerConsumer: number;
  percentage: number;
};

type ProducerEServiceMonitoringSaturationResult = {
  results: ProducerEServiceMonitoringSaturationConsumer[];
  totalCount: number;
  activeConsumers: number;
  customizedQuotaConsumers: number;
};

const discreteValueWithinRule = (
  discreteValue: Column,
  {
    minDiscreteValue,
    maxDiscreteValue,
    excludedDiscreteValue,
  }: CustomizedQuotaRule
): SQL | undefined =>
  and(
    minDiscreteValue !== null
      ? gte(discreteValue, minDiscreteValue)
      : undefined,
    maxDiscreteValue !== null
      ? lte(discreteValue, maxDiscreteValue)
      : undefined,
    excludedDiscreteValue !== null
      ? ne(discreteValue, excludedDiscreteValue)
      : undefined
  );

const customizedDailyCallsInTable = (
  db: DrizzleReturnType,
  table:
    | typeof tenantCertifiedAttributeInReadmodelTenant
    | typeof tenantCertifiedDiscreteAttributeInReadmodelTenant,
  rules: Array<{ rule: CustomizedQuotaRule; condition: SQL | undefined }>,
  consumerId: SQL | Column
): SQL => {
  const whenClauses = [...rules]
    .sort((a, b) => b.rule.dailyCallsPerConsumer - a.rule.dailyCallsPerConsumer)
    .map(
      ({ rule, condition }) =>
        sql`WHEN ${and(eq(table.attributeId, rule.attributeId), condition)} THEN ${rule.dailyCallsPerConsumer}::integer`
    );
  return sql`(${db
    .select({
      dailyCallsPerConsumer: sql<
        number | null
      >`MAX(CASE ${sql.join(whenClauses, sql` `)} END)`,
    })
    .from(table)
    .where(
      and(
        eq(table.tenantId, consumerId),
        inArray(table.attributeId, [
          ...new Set(rules.map(({ rule }) => rule.attributeId)),
        ]),
        isNull(table.revocationTimestamp)
      )
    )})`;
};

// Highest customized quota satisfied by the consumer, NULL when none is
// satisfied. Evaluates the rules of toCustomizedQuotaRules exactly like
// matchesCustomizedQuotaRule does in TypeScript (customizedQuotaRules.ts).
const customizedDailyCallsPerConsumer = (
  db: DrizzleReturnType,
  rules: CustomizedQuotaRule[],
  consumerId: SQL | Column
): SQL => {
  const certified = tenantCertifiedAttributeInReadmodelTenant;
  const discrete = tenantCertifiedDiscreteAttributeInReadmodelTenant;

  const perTable = [
    {
      table: certified,
      rules: rules
        .filter((rule) => rule.acceptsCertified)
        .map((rule) => ({ rule, condition: undefined })),
    },
    {
      table: discrete,
      rules: rules
        .filter((rule) => rule.acceptsCertifiedDiscrete)
        .map((rule) => ({
          rule,
          condition: discreteValueWithinRule(discrete.discreteValue, rule),
        })),
    },
  ]
    .filter(({ rules }) => rules.length > 0)
    .map(({ table, rules }) =>
      customizedDailyCallsInTable(db, table, rules, consumerId)
    );

  if (perTable.length === 0) {
    return sql`NULL::integer`;
  }
  // GREATEST ignores NULLs: NULL only when no table has a satisfied rule
  return perTable.length === 1
    ? perTable[0]
    : sql`GREATEST(${sql.join(perTable, sql`, `)})`;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const addDelegationJoins = <T extends PgSelect>(query: T) =>
  query
    .leftJoin(
      activeProducerDelegations,
      and(
        eq(
          purposeInReadmodelPurpose.eserviceId,
          activeProducerDelegations.eserviceId
        ),
        eq(activeProducerDelegations.state, delegationState.active),
        eq(activeProducerDelegations.kind, delegationKind.delegatedProducer),
        eq(
          activeProducerDelegations.delegatorId,
          eserviceInReadmodelCatalog.producerId
        )
      )
    )
    .leftJoin(
      activeConsumerDelegations,
      and(
        eq(
          purposeInReadmodelPurpose.eserviceId,
          activeConsumerDelegations.eserviceId
        ),
        eq(activeConsumerDelegations.state, delegationState.active),
        eq(activeConsumerDelegations.kind, delegationKind.delegatedConsumer),
        eq(
          activeConsumerDelegations.delegatorId,
          purposeInReadmodelPurpose.consumerId
        ),
        eq(purposeInReadmodelPurpose.delegationId, activeConsumerDelegations.id)
      )
    );

const getPurposesIdsFilter = (purposesIds: PurposeId[]): SQL | undefined =>
  purposesIds.length > 0
    ? inArray(purposeInReadmodelPurpose.id, purposesIds)
    : undefined;

const getProducerIdsFilter = (producersIds: TenantId[]): SQL | undefined =>
  producersIds.length > 0
    ? or(
        inArray(eserviceInReadmodelCatalog.producerId, producersIds),
        inArray(activeProducerDelegations.delegateId, producersIds)
      )
    : undefined;

const getConsumerIdsFilter = (consumersIds: TenantId[]): SQL | undefined =>
  consumersIds.length > 0
    ? or(
        inArray(purposeInReadmodelPurpose.consumerId, consumersIds),
        inArray(activeConsumerDelegations.delegateId, consumersIds)
      )
    : undefined;

const getVisibilityFilter = (requesterId: TenantId): SQL | undefined =>
  or(
    eq(eserviceInReadmodelCatalog.producerId, requesterId),
    eq(purposeInReadmodelPurpose.consumerId, requesterId),
    eq(activeProducerDelegations.delegateId, requesterId),
    eq(activeConsumerDelegations.delegateId, requesterId)
  );

const getReviewerIdFilter = (
  db: DrizzleReturnType,
  reviewerId: UserId | undefined
): SQL | undefined =>
  reviewerId
    ? exists(
        db
          .select()
          .from(riskAnalysisReviewerInReadmodelPurpose)
          .where(
            and(
              isNotNull(
                riskAnalysisReviewerInReadmodelPurpose.sentToReviewerAt
              ),
              eq(
                riskAnalysisReviewerInReadmodelPurpose.purposeId,
                purposeInReadmodelPurpose.id
              ),
              eq(riskAnalysisReviewerInReadmodelPurpose.reviewerId, reviewerId)
            )
          )
      )
    : undefined;

const getSigningStateFilter = (
  signingStates: RiskAnalysisSigningState[] | undefined
): SQL | undefined =>
  signingStates && signingStates.length > 0
    ? inArray(
        purposeInReadmodelPurpose.reviewerWorkflowSigningState,
        signingStates
      )
    : undefined;

const getPurposesFilters = (
  db: DrizzleReturnType,
  filters: Pick<
    GetPurposesFilters,
    | "title"
    | "eservicesIds"
    | "states"
    | "excludeDraft"
    | "reviewerId"
    | "signingStates"
  >
): Array<SQL | undefined> => {
  const {
    title,
    eservicesIds,
    states,
    excludeDraft,
    reviewerId,
    signingStates,
  } = filters;
  const titleFilter = title
    ? ilikeEscaped(purposeInReadmodelPurpose.title, `%${escapeSqlLike(title)}%`)
    : undefined;

  const eservicesIdsFilter =
    eservicesIds.length > 0
      ? inArray(purposeInReadmodelPurpose.eserviceId, eservicesIds)
      : undefined;

  const versionStateFilter =
    states.length > 0
      ? and(
          or(
            ...states.map((state) =>
              state === purposeVersionState.archived
                ? notExists(
                    db
                      .select()
                      .from(purposeVersionInReadmodelPurpose)
                      .where(
                        and(
                          eq(
                            purposeVersionInReadmodelPurpose.purposeId,
                            purposeInReadmodelPurpose.id
                          ),
                          ne(
                            purposeVersionInReadmodelPurpose.state,
                            purposeVersionState.archived
                          )
                        )
                      )
                  )
                : eq(purposeVersionInReadmodelPurpose.state, state)
            )
          ),
          isNotNull(purposeVersionInReadmodelPurpose.state)
        )
      : undefined;

  const draftFilter = excludeDraft
    ? and(
        ne(purposeVersionInReadmodelPurpose.state, purposeVersionState.draft),
        isNotNull(purposeVersionInReadmodelPurpose.state)
      )
    : undefined;

  const reviewerIdFilter = getReviewerIdFilter(db, reviewerId);
  const signingStateFilter = getSigningStateFilter(signingStates);

  return [
    titleFilter,
    eservicesIdsFilter,
    versionStateFilter,
    draftFilter,
    reviewerIdFilter,
    signingStateFilter,
  ];
};

const buildProducerDashboardSaturationQuery = (
  db: DrizzleReturnType,
  producerId: TenantId
) => {
  const descriptors = eserviceDescriptorInReadmodelCatalog;
  const eservices = eserviceInReadmodelCatalog;

  // Descriptors of the e-services the requester acts on as producer: own
  // e-services without an active producer delegation, or delegated ones.
  const scope = db.$with("saturation_scope").as(
    db
      .select({
        descriptorId: sql<string>`${descriptors.id}`.as("sat_descriptor_id"),
        eserviceId: sql<string>`${eservices.id}`.as("sat_eservice_id"),
        eserviceName: sql<string>`${eservices.name}`.as("sat_eservice_name"),
        version: sql<string>`${descriptors.version}`.as("sat_version"),
        dailyCallsTotal: sql<number>`${descriptors.dailyCallsTotal}`.as(
          "sat_daily_calls_total"
        ),
      })
      .from(descriptors)
      .innerJoin(eservices, eq(eservices.id, descriptors.eserviceId))
      .leftJoin(
        activeProducerDelegations,
        and(
          eq(activeProducerDelegations.eserviceId, eservices.id),
          eq(activeProducerDelegations.state, delegationState.active),
          eq(activeProducerDelegations.kind, delegationKind.delegatedProducer),
          eq(activeProducerDelegations.delegatorId, eservices.producerId)
        )
      )
      .where(
        and(
          inArray(descriptors.state, producerDashboardDescriptorStates),
          or(
            and(
              eq(eservices.producerId, producerId),
              isNull(activeProducerDelegations.id)
            ),
            eq(activeProducerDelegations.delegateId, producerId)
          )
        )
      )
  );

  // Load of every descriptor in scope in a single pass (GROUP BY), using the
  // same aggregation rule of the per-descriptor queries.
  const load = db.$with("saturation_load").as(
    db
      .select({
        descriptorId: sql<string>`${scope.descriptorId}`.as(
          "sat_load_descriptor_id"
        ),
        approvedDailyCalls:
          sql<string>`COALESCE(SUM(${purposeVersionInReadmodelPurpose.dailyCalls}) FILTER (WHERE ${purposeVersionInReadmodelPurpose.state} = ${approvedLoadVersionState}), 0)`.as(
            "sat_approved_daily_calls"
          ),
        waitingForApprovalDailyCalls:
          sql<string>`COALESCE(SUM(${purposeVersionInReadmodelPurpose.dailyCalls}) FILTER (WHERE ${purposeVersionInReadmodelPurpose.state} = ${waitingForApprovalLoadVersionState}), 0)`.as(
            "sat_waiting_daily_calls"
          ),
        activePurposesCount:
          sql<string>`COUNT(DISTINCT ${purposeInReadmodelPurpose.id}) FILTER (WHERE ${purposeVersionInReadmodelPurpose.state} = ${approvedLoadVersionState})`.as(
            "sat_active_purposes_count"
          ),
      })
      .from(purposeInReadmodelPurpose)
      .innerJoin(
        purposeVersionInReadmodelPurpose,
        eq(
          purposeVersionInReadmodelPurpose.purposeId,
          purposeInReadmodelPurpose.id
        )
      )
      .innerJoin(agreementInReadmodelAgreement, purposeAgreementLoadCondition())
      .innerJoin(
        scope,
        eq(scope.descriptorId, agreementInReadmodelAgreement.descriptorId)
      )
      .where(
        inArray(purposeVersionInReadmodelPurpose.state, [
          approvedLoadVersionState,
          waitingForApprovalLoadVersionState,
        ])
      )
      .groupBy(scope.descriptorId)
  );

  const approved = sql`COALESCE(${load.approvedDailyCalls}, 0)`;
  const percentage = sql`CASE WHEN ${scope.dailyCallsTotal} > 0 THEN ${approved} * 100.0 / ${scope.dailyCallsTotal} ELSE 0 END`;
  const isOver = sql`(${scope.dailyCallsTotal} > 0 AND ${approved} > ${scope.dailyCallsTotal})`;
  const isNear = sql`(NOT ${isOver} AND ${percentage} > ${producerDashboardNearThresholdPercentage})`;

  return { scope, load, approved, percentage, isOver, isNear };
};

export function readModelServiceBuilderSQL({
  readModelDB,
  purposeReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
  delegationReadModelServiceSQL,
  purposeTemplateReadModelServiceSQL,
  clientReadModelServiceSQL,
  tenantKindHistoryDB,
}: {
  readModelDB: DrizzleReturnType;
  purposeReadModelServiceSQL: PurposeReadModelService;
  catalogReadModelServiceSQL: CatalogReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
  agreementReadModelServiceSQL: AgreementReadModelService;
  delegationReadModelServiceSQL: DelegationReadModelService;
  purposeTemplateReadModelServiceSQL: PurposeTemplateReadModelService;
  clientReadModelServiceSQL: ClientReadModelService;
  tenantKindHistoryDB: DrizzleReturnType;
}) {
  return {
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(id))?.data;
    },
    async getTenantById(id: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(id))?.data;
    },
    async getPurposeById(
      id: PurposeId
    ): Promise<WithMetadata<Purpose> | undefined> {
      return purposeReadModelServiceSQL.getPurposeById(id);
    },
    async getPurpose(
      eserviceId: EServiceId,
      consumerId: TenantId,
      title: string
    ): Promise<WithMetadata<Purpose> | undefined> {
      return await purposeReadModelServiceSQL.getPurposeByFilter(
        and(
          eq(purposeInReadmodelPurpose.eserviceId, eserviceId),
          eq(purposeInReadmodelPurpose.consumerId, consumerId),
          ilikeEscaped(purposeInReadmodelPurpose.title, escapeSqlLike(title))
        )
      );
    },
    async getTenantKindAt(
      tenantId: TenantId,
      date: Date
    ): Promise<TenantKind | undefined> {
      const [result] = await tenantKindHistoryDB
        .select()
        .from(tenantKindHistory)
        .where(
          and(
            eq(tenantKindHistory.tenantId, tenantId),
            lte(tenantKindHistory.modifiedAt, date.toISOString())
          )
        )
        .orderBy(desc(tenantKindHistory.modifiedAt))
        .limit(1);
      return result?.kind ? TenantKind.parse(result.kind) : undefined;
    },
    async getFirstTenantKind(
      tenantId: TenantId
    ): Promise<TenantKind | undefined> {
      const [result] = await tenantKindHistoryDB
        .select()
        .from(tenantKindHistory)
        .where(eq(tenantKindHistory.tenantId, tenantId))
        .orderBy(asc(tenantKindHistory.modifiedAt))
        .limit(1);
      return result?.kind ? TenantKind.parse(result.kind) : undefined;
    },
    async getPurposes(
      requesterId: TenantId,
      filters: GetPurposesFilters,
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ListResult<Purpose>> {
      const { producersIds, consumersIds, purposesIds, ...otherFilters } =
        filters;
      const {
        reviewerId,
        signingStates,
        sortByRiskAnalysisAssignmentDateDescending,
      } = otherFilters;
      const orderBy = [
        ascLower(purposeInReadmodelPurpose.title),
        asc(purposeInReadmodelPurpose.id),
      ];

      if (
        sortByRiskAnalysisAssignmentDateDescending === true &&
        reviewerId &&
        signingStates &&
        signingStates.length > 0
      ) {
        if (
          signingStates.every(
            (state) =>
              state === riskAnalysisSigningState.assigned ||
              state === riskAnalysisSigningState.submitted
          )
        ) {
          const assignmentDate = readModelDB
            .select({
              sentToReviewerAt:
                riskAnalysisReviewerInReadmodelPurpose.sentToReviewerAt,
            })
            .from(riskAnalysisReviewerInReadmodelPurpose)
            .where(
              and(
                eq(
                  riskAnalysisReviewerInReadmodelPurpose.purposeId,
                  purposeInReadmodelPurpose.id
                ),
                eq(
                  riskAnalysisReviewerInReadmodelPurpose.reviewerId,
                  reviewerId
                )
              )
            );
          orderBy.unshift(sql`(${assignmentDate}) desc nulls last`);
        } else if (
          signingStates.every(
            (state) =>
              state === riskAnalysisSigningState.signed ||
              state === riskAnalysisSigningState.rejected
          )
        ) {
          orderBy.unshift(
            sql`coalesce(${purposeInReadmodelPurpose.reviewerWorkflowSignedAt}, ${purposeInReadmodelPurpose.reviewerWorkflowRejectedAt}) desc nulls last`
          );
        }
      }

      const subquery = addDelegationJoins(
        readModelDB
          .select(
            withTotalCount({
              purposeId: purposeInReadmodelPurpose.id,
            })
          )
          .from(purposeInReadmodelPurpose)
          .leftJoin(
            purposeVersionInReadmodelPurpose,
            eq(
              purposeInReadmodelPurpose.id,
              purposeVersionInReadmodelPurpose.purposeId
            )
          )
          .leftJoin(
            eserviceInReadmodelCatalog,
            eq(
              purposeInReadmodelPurpose.eserviceId,
              eserviceInReadmodelCatalog.id
            )
          )
          .where(
            and(
              getProducerIdsFilter(producersIds),
              getConsumerIdsFilter(consumersIds),
              getVisibilityFilter(requesterId),
              getPurposesIdsFilter(purposesIds),
              ...getPurposesFilters(readModelDB, otherFilters)
            )
          )
          .groupBy(purposeInReadmodelPurpose.id)
          .orderBy(...orderBy)
          .limit(limit)
          .offset(offset)
          .$dynamic()
      ).as("subquery");

      const queryResult = await readModelDB
        .select({
          purpose: purposeInReadmodelPurpose,
          purposeRiskAnalysisForm: purposeRiskAnalysisFormInReadmodelPurpose,
          purposeRiskAnalysisAnswer:
            purposeRiskAnalysisAnswerInReadmodelPurpose,
          purposeVersion: purposeVersionInReadmodelPurpose,
          purposeVersionDocument: purposeVersionDocumentInReadmodelPurpose,
          purposeVersionStamp: purposeVersionStampInReadmodelPurpose,
          purposeVersionSignedDocument:
            purposeVersionSignedDocumentInReadmodelPurpose,
          purposeRiskAnalysisReviewer: riskAnalysisReviewerInReadmodelPurpose,
          totalCount: subquery.totalCount,
        })
        .from(purposeInReadmodelPurpose)
        .innerJoin(
          subquery,
          eq(purposeInReadmodelPurpose.id, subquery.purposeId)
        )
        .leftJoin(
          purposeRiskAnalysisFormInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            purposeRiskAnalysisFormInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          purposeRiskAnalysisAnswerInReadmodelPurpose,
          and(
            eq(
              purposeInReadmodelPurpose.id,
              purposeRiskAnalysisAnswerInReadmodelPurpose.purposeId
            ),
            eq(
              purposeRiskAnalysisFormInReadmodelPurpose.id,
              purposeRiskAnalysisAnswerInReadmodelPurpose.riskAnalysisFormId
            )
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
        )
        .leftJoin(
          purposeVersionStampInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionStampInReadmodelPurpose.purposeVersionId
          )
        )
        .leftJoin(
          purposeVersionSignedDocumentInReadmodelPurpose,
          eq(
            purposeVersionInReadmodelPurpose.id,
            purposeVersionSignedDocumentInReadmodelPurpose.purposeVersionId
          )
        )
        .leftJoin(
          riskAnalysisReviewerInReadmodelPurpose,
          eq(
            purposeInReadmodelPurpose.id,
            riskAnalysisReviewerInReadmodelPurpose.purposeId
          )
        )
        .leftJoin(
          delegationInReadmodelDelegation,
          eq(
            purposeInReadmodelPurpose.eserviceId,
            delegationInReadmodelDelegation.eserviceId
          )
        )
        .leftJoin(
          eserviceInReadmodelCatalog,
          eq(
            purposeInReadmodelPurpose.eserviceId,
            eserviceInReadmodelCatalog.id
          )
        )
        .orderBy(...orderBy);

      const purposes = aggregatePurposeArray(
        toPurposeAggregatorArray(queryResult)
      );
      return createListResult(
        purposes.map((p) => p.data),
        queryResult[0]?.totalCount
      );
    },
    async getActiveAgreement(
      eserviceId: EServiceId,
      consumerId: TenantId
    ): Promise<Agreement | undefined> {
      return (
        await agreementReadModelServiceSQL.getAgreementByFilter(
          and(
            eq(agreementInReadmodelAgreement.eserviceId, eserviceId),
            eq(agreementInReadmodelAgreement.consumerId, consumerId),
            eq(agreementInReadmodelAgreement.state, agreementState.active)
          )
        )
      )?.data;
    },
    async getActiveVersionsDailyCalls(
      eserviceId: EServiceId,
      consumerId: TenantId,
      descriptorId: DescriptorId
    ): Promise<{ consumerDailyCalls: number; totalDailyCalls: number }> {
      // Aggregates the daily calls of the Active purpose versions for the given
      // e-service directly in the DB, returning both the total across all
      // consumers with an Active or Suspended agreement on the given descriptor
      // and the amount attributable to the requesting consumer.
      // This avoids loading every purpose of the e-service into memory (which,
      // for e-services with many purposes, could exhaust the heap and lead to OOM).
      const [result] = await addActiveVersionsDailyCallsJoinsAndFilters(
        readModelDB
          .select({
            totalDailyCalls:
              sql`COALESCE(SUM(${purposeVersionInReadmodelPurpose.dailyCalls}), 0)`.mapWith(
                Number
              ),
            consumerDailyCalls:
              sql`COALESCE(SUM(${purposeVersionInReadmodelPurpose.dailyCalls}) FILTER (WHERE ${purposeInReadmodelPurpose.consumerId} = ${consumerId}), 0)`.mapWith(
                Number
              ),
          })
          .from(purposeInReadmodelPurpose)
          .$dynamic(),
        eserviceId,
        descriptorId
      );

      return {
        consumerDailyCalls: result?.consumerDailyCalls ?? 0,
        totalDailyCalls: result?.totalDailyCalls ?? 0,
      };
    },
    async getDescriptorActiveDailyCalls(
      eserviceId: EServiceId,
      descriptorId: DescriptorId
    ): Promise<number> {
      // Total daily calls of the Active purpose versions across all the
      // consumers with an Active or Suspended agreement on the given descriptor.
      const [result] = await addActiveVersionsDailyCallsJoinsAndFilters(
        readModelDB
          .select({
            totalDailyCalls:
              sql`COALESCE(SUM(${purposeVersionInReadmodelPurpose.dailyCalls}), 0)`.mapWith(
                Number
              ),
          })
          .from(purposeInReadmodelPurpose)
          .$dynamic(),
        eserviceId,
        descriptorId
      );

      return result?.totalDailyCalls ?? 0;
    },
    async getActiveProducerDelegationByEserviceId(
      eserviceId: EServiceId
    ): Promise<Delegation | undefined> {
      return (
        await delegationReadModelServiceSQL.getDelegationByFilter(
          and(
            eq(delegationInReadmodelDelegation.eserviceId, eserviceId),
            eq(delegationInReadmodelDelegation.state, delegationState.active),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedProducer
            )
          )
        )
      )?.data;
    },
    async getActiveConsumerDelegationByEserviceAndConsumerIds({
      eserviceId,
      consumerId,
    }: {
      eserviceId: EServiceId;
      consumerId: TenantId;
    }): Promise<Delegation | undefined> {
      return (
        await delegationReadModelServiceSQL.getDelegationByFilter(
          and(
            eq(delegationInReadmodelDelegation.eserviceId, eserviceId),
            eq(delegationInReadmodelDelegation.delegatorId, consumerId),
            eq(delegationInReadmodelDelegation.state, delegationState.active),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedConsumer
            )
          )
        )
      )?.data;
    },
    async getActiveConsumerDelegationByDelegationId(
      delegationId: DelegationId
    ): Promise<Delegation | undefined> {
      return (
        await delegationReadModelServiceSQL.getDelegationByFilter(
          and(
            eq(delegationInReadmodelDelegation.id, delegationId),
            eq(delegationInReadmodelDelegation.state, delegationState.active),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedConsumer
            )
          )
        )
      )?.data;
    },
    async getPublishedPurposeTemplateById(
      purposeTemplateId: PurposeTemplateId
    ): Promise<PurposeTemplate | undefined> {
      return (
        await purposeTemplateReadModelServiceSQL.getPurposeTemplateByFilter(
          and(
            eq(purposeTemplateInReadmodelPurposeTemplate.id, purposeTemplateId),
            eq(
              purposeTemplateInReadmodelPurposeTemplate.state,
              purposeTemplateState.published
            )
          )
        )
      )?.data;
    },
    async getClientById(
      id: ClientId
    ): Promise<WithMetadata<Client> | undefined> {
      return clientReadModelServiceSQL.getClientById(id);
    },
    async getProducerDashboardSaturation(
      producerId: TenantId,
      { q, sortBy }: { q: string | undefined; sortBy: SaturationSortBy },
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ProducerDashboardSaturationResult> {
      const { scope, load, approved, percentage, isOver, isNear } =
        buildProducerDashboardSaturationQuery(readModelDB, producerId);
      const eservices = eserviceInReadmodelCatalog;
      const nameFilter = q
        ? ilikeEscaped(eservices.name, `%${escapeSqlLike(q)}%`)
        : undefined;
      const summary = readModelDB.$with("saturation_summary").as(
        readModelDB
          .select({
            overThreshold: sql<number>`COUNT(*) FILTER (WHERE ${isOver})`
              .mapWith(Number)
              .as("sat_summary_over_threshold"),
            nearThreshold: sql<number>`COUNT(*) FILTER (WHERE ${isNear})`
              .mapWith(Number)
              .as("sat_summary_near_threshold"),
            total: sql<number>`COUNT(*)`
              .mapWith(Number)
              .as("sat_summary_total"),
          })
          .from(scope)
          .leftJoin(load, eq(load.descriptorId, scope.descriptorId))
      );

      const versionNumber = sql`CAST(${scope.version} AS INTEGER)`;
      const orderBy = match(sortBy)
        .with("PERCENTAGE_DESC", () => [desc(percentage)])
        .with("PERCENTAGE_ASC", () => [asc(percentage)])
        .with("NAME_ASC", () => [asc(sql`lower(${scope.eserviceName})`)])
        .with("NAME_DESC", () => [desc(sql`lower(${scope.eserviceName})`)])
        .exhaustive();

      const rows = await readModelDB
        .with(scope, load, summary)
        .select({
          eserviceId: scope.eserviceId,
          eserviceName: scope.eserviceName,
          descriptorId: scope.descriptorId,
          version: scope.version,
          dailyCallsTotal: scope.dailyCallsTotal,
          approvedDailyCalls: approved.mapWith(Number),
          waitingForApprovalDailyCalls:
            sql`COALESCE(${load.waitingForApprovalDailyCalls}, 0)`.mapWith(
              Number
            ),
          activePurposesCount:
            sql`COALESCE(${load.activePurposesCount}, 0)`.mapWith(Number),
          totalCount: sql`COUNT(*) OVER ()`.mapWith(Number),
          summaryOverThreshold: summary.overThreshold,
          summaryNearThreshold: summary.nearThreshold,
          summaryTotal: summary.total,
        })
        .from(scope)
        .leftJoin(load, eq(load.descriptorId, scope.descriptorId))
        .innerJoin(summary, sql`true`)
        .innerJoin(eservices, eq(eservices.id, scope.eserviceId))
        .where(nameFilter)
        .orderBy(
          ...orderBy,
          asc(sql`lower(${scope.eserviceName})`),
          asc(versionNumber),
          asc(scope.descriptorId)
        )
        .limit(limit)
        .offset(offset);

      const results = rows.map((r) => ({
        eserviceId: unsafeBrandId<EServiceId>(r.eserviceId),
        eserviceName: r.eserviceName,
        descriptorId: unsafeBrandId<DescriptorId>(r.descriptorId),
        version: r.version,
        activePurposesCount: r.activePurposesCount,
        approvedDailyCalls: r.approvedDailyCalls,
        dailyCallsTotal: Number(r.dailyCallsTotal),
        waitingForApprovalDailyCalls: r.waitingForApprovalDailyCalls,
      }));

      const [firstRow] = rows;
      if (firstRow) {
        return {
          results,
          totalCount: firstRow.totalCount,
          summary: {
            overThreshold: firstRow.summaryOverThreshold,
            nearThreshold: firstRow.summaryNearThreshold,
            total: firstRow.summaryTotal,
          },
        };
      }

      // Window counts are absent when the requested page has no rows. Compute
      // the unfiltered summary and filtered result count independently.
      const [emptyPageSummary] = await readModelDB
        .with(scope, load)
        .select({
          totalCount:
            sql<number>`COUNT(*) FILTER (WHERE ${nameFilter ?? sql`true`})`.mapWith(
              Number
            ),
          overThreshold: sql<number>`COUNT(*) FILTER (WHERE ${isOver})`.mapWith(
            Number
          ),
          nearThreshold: sql<number>`COUNT(*) FILTER (WHERE ${isNear})`.mapWith(
            Number
          ),
          total: sql<number>`COUNT(*)`.mapWith(Number),
        })
        .from(scope)
        .leftJoin(load, eq(load.descriptorId, scope.descriptorId))
        .innerJoin(eservices, eq(eservices.id, scope.eserviceId));

      return {
        results,
        totalCount: emptyPageSummary?.totalCount ?? 0,
        summary: {
          overThreshold: emptyPageSummary?.overThreshold ?? 0,
          nearThreshold: emptyPageSummary?.nearThreshold ?? 0,
          total: emptyPageSummary?.total ?? 0,
        },
      };
    },
    async getProducerEServiceMonitoringSaturation(
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      {
        defaultDailyCallsPerConsumer,
        customizedQuotaRules,
      }: {
        defaultDailyCallsPerConsumer: number;
        customizedQuotaRules: CustomizedQuotaRule[];
      },
      { q, sortBy }: { q: string | undefined; sortBy: SaturationSortBy },
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ProducerEServiceMonitoringSaturationResult> {
      const consumerLoad = readModelDB.$with("consumer_saturation_load").as(
        readModelDB
          .select({
            consumerId: sql<string>`${purposeInReadmodelPurpose.consumerId}`.as(
              "consumer_saturation_consumer_id"
            ),
            approvedDailyCalls:
              sql<number>`COALESCE(SUM(${purposeVersionInReadmodelPurpose.dailyCalls}) FILTER (WHERE ${purposeVersionInReadmodelPurpose.state} = ${approvedLoadVersionState}), 0)`
                .mapWith(Number)
                .as("consumer_saturation_approved_daily_calls"),
            waitingForApprovalDailyCalls:
              sql<number>`COALESCE(SUM(${purposeVersionInReadmodelPurpose.dailyCalls}) FILTER (WHERE ${purposeVersionInReadmodelPurpose.state} = ${waitingForApprovalLoadVersionState}), 0)`
                .mapWith(Number)
                .as("consumer_saturation_waiting_daily_calls"),
            activePurposesCount:
              sql<number>`COUNT(DISTINCT ${purposeInReadmodelPurpose.id}) FILTER (WHERE ${purposeVersionInReadmodelPurpose.state} = ${approvedLoadVersionState})`
                .mapWith(Number)
                .as("consumer_saturation_active_purposes_count"),
          })
          .from(purposeInReadmodelPurpose)
          .innerJoin(
            purposeVersionInReadmodelPurpose,
            eq(
              purposeVersionInReadmodelPurpose.purposeId,
              purposeInReadmodelPurpose.id
            )
          )
          .innerJoin(
            agreementInReadmodelAgreement,
            purposeAgreementLoadCondition()
          )
          .where(
            and(
              eq(agreementInReadmodelAgreement.eserviceId, eserviceId),
              eq(agreementInReadmodelAgreement.descriptorId, descriptorId),
              eq(agreementInReadmodelAgreement.state, agreementState.active),
              inArray(purposeVersionInReadmodelPurpose.state, [
                approvedLoadVersionState,
                waitingForApprovalLoadVersionState,
              ])
            )
          )
          .groupBy(purposeInReadmodelPurpose.consumerId)
      );

      // One row per active consumer of the descriptor, with its load and its
      // customized quota (NULL when the descriptor default applies)
      const scope = readModelDB.$with("consumer_saturation_scope").as(
        readModelDB
          .selectDistinct({
            consumerId:
              sql<string>`${agreementInReadmodelAgreement.consumerId}`.as(
                "consumer_saturation_scope_consumer_id"
              ),
            consumerName: sql<string>`${tenantInReadmodelTenant.name}`.as(
              "consumer_saturation_scope_consumer_name"
            ),
            consumerKind: sql<
              string | null
            >`${tenantInReadmodelTenant.kind}`.as(
              "consumer_saturation_scope_consumer_kind"
            ),
            activePurposesCount:
              sql<number>`COALESCE(${consumerLoad.activePurposesCount}, 0)`.as(
                "consumer_saturation_scope_active_purposes_count"
              ),
            approvedDailyCalls:
              sql<number>`COALESCE(${consumerLoad.approvedDailyCalls}, 0)`.as(
                "consumer_saturation_scope_approved_daily_calls"
              ),
            waitingForApprovalDailyCalls:
              sql<number>`COALESCE(${consumerLoad.waitingForApprovalDailyCalls}, 0)`.as(
                "consumer_saturation_scope_waiting_daily_calls"
              ),
            customizedDailyCallsPerConsumer: sql<
              number | null
            >`${customizedDailyCallsPerConsumer(readModelDB, customizedQuotaRules, agreementInReadmodelAgreement.consumerId)}`.as(
              "consumer_saturation_scope_customized_daily_calls"
            ),
          })
          .from(agreementInReadmodelAgreement)
          .innerJoin(
            tenantInReadmodelTenant,
            eq(
              tenantInReadmodelTenant.id,
              agreementInReadmodelAgreement.consumerId
            )
          )
          .leftJoin(
            consumerLoad,
            eq(
              consumerLoad.consumerId,
              agreementInReadmodelAgreement.consumerId
            )
          )
          .where(
            and(
              eq(agreementInReadmodelAgreement.eserviceId, eserviceId),
              eq(agreementInReadmodelAgreement.descriptorId, descriptorId),
              eq(agreementInReadmodelAgreement.state, agreementState.active)
            )
          )
      );

      // Unfiltered counters, independent from q and pagination
      const summary = readModelDB.$with("consumer_saturation_summary").as(
        readModelDB
          .select({
            activeConsumers: sql<number>`COUNT(*)`.as(
              "consumer_saturation_summary_active_consumers"
            ),
            customizedQuotaConsumers:
              sql<number>`COUNT(*) FILTER (WHERE ${scope.customizedDailyCallsPerConsumer} IS NOT NULL)`.as(
                "consumer_saturation_summary_customized_consumers"
              ),
          })
          .from(scope)
      );

      const effectiveDailyCallsPerConsumer = sql<number>`COALESCE(${scope.customizedDailyCallsPerConsumer}, ${defaultDailyCallsPerConsumer}::integer)`;
      // Same operation order as the TypeScript computation (approved / quota * 100)
      // on float8, so the values (and their rounding) are identical
      const percentage = sql<number>`CASE WHEN ${effectiveDailyCallsPerConsumer} > 0 THEN (${scope.approvedDailyCalls}::float8 / ${effectiveDailyCallsPerConsumer}) * 100 ELSE 0::float8 END`;
      const consumerNameLower = sql`lower(${scope.consumerName})`;
      const nameFilter = q
        ? ilikeEscaped(scope.consumerName, `%${escapeSqlLike(q)}%`)
        : undefined;
      // The consumer id is always the last tie-breaker, ascending
      const orderBy = match(sortBy)
        .with("PERCENTAGE_DESC", () => [
          desc(percentage),
          asc(consumerNameLower),
        ])
        .with("PERCENTAGE_ASC", () => [asc(percentage), asc(consumerNameLower)])
        .with("NAME_ASC", () => [asc(consumerNameLower)])
        .with("NAME_DESC", () => [desc(consumerNameLower)])
        .exhaustive();

      const rows = await readModelDB
        .with(consumerLoad, scope, summary)
        .select({
          consumerId: scope.consumerId,
          consumerName: scope.consumerName,
          consumerKind: scope.consumerKind,
          activePurposesCount:
            sql<number>`${scope.activePurposesCount}`.mapWith(Number),
          approvedDailyCalls: sql<number>`${scope.approvedDailyCalls}`.mapWith(
            Number
          ),
          waitingForApprovalDailyCalls:
            sql<number>`${scope.waitingForApprovalDailyCalls}`.mapWith(Number),
          dailyCallsPerConsumer: effectiveDailyCallsPerConsumer.mapWith(Number),
          percentage: percentage.mapWith(Number),
          totalCount: sql<number>`COUNT(*) OVER ()`.mapWith(Number),
          activeConsumers: sql<number>`${summary.activeConsumers}`.mapWith(
            Number
          ),
          customizedQuotaConsumers:
            sql<number>`${summary.customizedQuotaConsumers}`.mapWith(Number),
        })
        .from(scope)
        .innerJoin(summary, sql`true`)
        .where(nameFilter)
        .orderBy(...orderBy, asc(scope.consumerId))
        .limit(limit)
        .offset(offset);

      const results = rows.map((row) => ({
        consumerId: unsafeBrandId<TenantId>(row.consumerId),
        consumerName: row.consumerName,
        consumerKind: row.consumerKind
          ? (row.consumerKind as TenantKind)
          : undefined,
        activePurposesCount: row.activePurposesCount,
        approvedDailyCalls: row.approvedDailyCalls,
        waitingForApprovalDailyCalls: row.waitingForApprovalDailyCalls,
        dailyCallsPerConsumer: row.dailyCallsPerConsumer,
        percentage: row.percentage,
      }));

      const [firstRow] = rows;
      if (firstRow) {
        return {
          results,
          totalCount: firstRow.totalCount,
          activeConsumers: firstRow.activeConsumers,
          customizedQuotaConsumers: firstRow.customizedQuotaConsumers,
        };
      }

      // Window and summary values are absent when the requested page has no
      // rows: compute the filtered count and the counters independently
      const [emptyPageCounts] = await readModelDB
        .with(consumerLoad, scope)
        .select({
          totalCount:
            sql<number>`COUNT(*) FILTER (WHERE ${nameFilter ?? sql`true`})`.mapWith(
              Number
            ),
          activeConsumers: sql<number>`COUNT(*)`.mapWith(Number),
          customizedQuotaConsumers:
            sql<number>`COUNT(*) FILTER (WHERE ${scope.customizedDailyCallsPerConsumer} IS NOT NULL)`.mapWith(
              Number
            ),
        })
        .from(scope);

      return {
        results,
        totalCount: emptyPageCounts?.totalCount ?? 0,
        activeConsumers: emptyPageCounts?.activeConsumers ?? 0,
        customizedQuotaConsumers:
          emptyPageCounts?.customizedQuotaConsumers ?? 0,
      };
    },
    async getWaitingForApprovalPurposesCounts(
      eserviceId: EServiceId,
      descriptorId: DescriptorId
    ): Promise<{ newPurposes: number; quotaChanges: number }> {
      // A purpose waiting for approval is "new" if it has no Active/Suspended version,
      // a "quota change" otherwise. Each purpose is counted once.
      const waitingVersion = alias(
        purposeVersionInReadmodelPurpose,
        "waiting_version"
      );
      const approvedVersion = alias(
        purposeVersionInReadmodelPurpose,
        "approved_version"
      );
      const hasApprovedVersion = exists(
        readModelDB
          .select({ one: sql`1` })
          .from(approvedVersion)
          .where(
            and(
              eq(approvedVersion.purposeId, purposeInReadmodelPurpose.id),
              inArray(approvedVersion.state, [
                purposeVersionState.active,
                purposeVersionState.suspended,
              ])
            )
          )
      );

      const [result] = await readModelDB
        .select({
          newPurposes:
            sql`COUNT(DISTINCT ${purposeInReadmodelPurpose.id}) FILTER (WHERE NOT ${hasApprovedVersion})`.mapWith(
              Number
            ),
          quotaChanges:
            sql`COUNT(DISTINCT ${purposeInReadmodelPurpose.id}) FILTER (WHERE ${hasApprovedVersion})`.mapWith(
              Number
            ),
        })
        .from(purposeInReadmodelPurpose)
        .innerJoin(
          agreementInReadmodelAgreement,
          and(
            eq(
              agreementInReadmodelAgreement.eserviceId,
              purposeInReadmodelPurpose.eserviceId
            ),
            eq(
              agreementInReadmodelAgreement.consumerId,
              purposeInReadmodelPurpose.consumerId
            ),
            inArray(agreementInReadmodelAgreement.state, [
              agreementState.active,
              agreementState.suspended,
            ])
          )
        )
        .where(
          and(
            eq(purposeInReadmodelPurpose.eserviceId, eserviceId),
            eq(agreementInReadmodelAgreement.descriptorId, descriptorId),
            exists(
              readModelDB
                .select({ one: sql`1` })
                .from(waitingVersion)
                .where(
                  and(
                    eq(waitingVersion.purposeId, purposeInReadmodelPurpose.id),
                    eq(
                      waitingVersion.state,
                      purposeVersionState.waitingForApproval
                    )
                  )
                )
            )
          )
        );

      return {
        newPurposes: result?.newPurposes ?? 0,
        quotaChanges: result?.quotaChanges ?? 0,
      };
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
