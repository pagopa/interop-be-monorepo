import {
  ascLower,
  createListResult,
  escapeRegExp,
  withTotalCount,
} from "pagopa-interop-commons";
import {
  EService,
  WithMetadata,
  EServiceId,
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
} from "pagopa-interop-models";
import {
  agreementInReadmodelAgreement,
  delegationInReadmodelDelegation,
  DrizzleReturnType,
  eserviceInReadmodelCatalog,
  purposeInReadmodelPurpose,
  purposeRiskAnalysisAnswerInReadmodelPurpose,
  purposeRiskAnalysisFormInReadmodelPurpose,
  purposeVersionDocumentInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
} from "pagopa-interop-readmodel-models";
import {
  aggregatePurposeArray,
  AgreementReadModelService,
  CatalogReadModelService,
  DelegationReadModelService,
  PurposeReadModelService,
  TenantReadModelService,
  toPurposeAggregatorArray,
} from "pagopa-interop-readmodel";
import {
  and,
  eq,
  ilike,
  inArray,
  isNotNull,
  ne,
  notExists,
  or,
  SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export type GetPurposesFilters = {
  title?: string;
  eservicesIds: EServiceId[];
  consumersIds: TenantId[];
  producersIds: TenantId[];
  states: PurposeVersionState[];
  excludeDraft: boolean | undefined;
};

function getPurposesFilters(
  db: DrizzleReturnType,
  filters: Pick<
    GetPurposesFilters,
    "title" | "eservicesIds" | "states" | "excludeDraft"
  >
): Array<SQL | undefined> {
  const { title, eservicesIds, states, excludeDraft } = filters;
  const titleFilter = title
    ? ilike(purposeInReadmodelPurpose.title, `%${escapeRegExp(title)}%`)
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

  return [titleFilter, eservicesIdsFilter, versionStateFilter, draftFilter];
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  purposeReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
  delegationReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  purposeReadModelServiceSQL: PurposeReadModelService;
  catalogReadModelServiceSQL: CatalogReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
  agreementReadModelServiceSQL: AgreementReadModelService;
  delegationReadModelServiceSQL: DelegationReadModelService;
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
          ilike(purposeInReadmodelPurpose.title, escapeRegExp(title))
        )
      );
    },
    async getPurposes(
      requesterId: TenantId,
      filters: GetPurposesFilters,
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ListResult<Purpose>> {
      const { producersIds, consumersIds, ...otherFilters } = filters;

      const activeProducerDelegations = alias(
        delegationInReadmodelDelegation,
        "activeProducerDelegations"
      );
      const activeConsumerDelegations = alias(
        delegationInReadmodelDelegation,
        "activeConsumerDelegations"
      );
      const subquery = readModelDB
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
        .leftJoin(
          activeProducerDelegations,
          and(
            eq(
              purposeInReadmodelPurpose.eserviceId,
              activeProducerDelegations.eserviceId
            ),
            eq(activeProducerDelegations.state, delegationState.active),
            eq(
              activeProducerDelegations.kind,
              delegationKind.delegatedProducer
            ),
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
            eq(
              activeConsumerDelegations.kind,
              delegationKind.delegatedConsumer
            ),
            eq(
              activeConsumerDelegations.delegatorId,
              purposeInReadmodelPurpose.consumerId
            ),
            eq(
              purposeInReadmodelPurpose.delegationId,
              activeConsumerDelegations.id
            )
          )
        )
        .where(
          // PRODUCER IDS
          and(
            producersIds.length > 0
              ? or(
                  inArray(eserviceInReadmodelCatalog.producerId, producersIds),
                  inArray(activeProducerDelegations.delegateId, producersIds)
                )
              : undefined,
            // CONSUMER IDS
            consumersIds.length > 0
              ? or(
                  inArray(purposeInReadmodelPurpose.consumerId, consumersIds),
                  inArray(activeConsumerDelegations.delegateId, consumersIds)
                )
              : undefined,
            // VISIBILITY
            or(
              eq(eserviceInReadmodelCatalog.producerId, requesterId),
              eq(purposeInReadmodelPurpose.consumerId, requesterId),
              eq(activeProducerDelegations.delegateId, requesterId),
              eq(activeConsumerDelegations.delegateId, requesterId)
            ),
            // PURPOSE FILTERS
            ...getPurposesFilters(readModelDB, otherFilters)
          )
        )
        .groupBy(purposeInReadmodelPurpose.id)
        .orderBy(ascLower(purposeInReadmodelPurpose.title))
        .limit(limit)
        .offset(offset)
        .as("subquery");

      const queryResult = await readModelDB
        .select({
          purpose: purposeInReadmodelPurpose,
          purposeRiskAnalysisForm: purposeRiskAnalysisFormInReadmodelPurpose,
          purposeRiskAnalysisAnswer:
            purposeRiskAnalysisAnswerInReadmodelPurpose,
          purposeVersion: purposeVersionInReadmodelPurpose,
          purposeVersionDocument: purposeVersionDocumentInReadmodelPurpose,
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
        .orderBy(ascLower(purposeInReadmodelPurpose.title));

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
    async getAllPurposes(
      filters: Pick<
        GetPurposesFilters,
        "eservicesIds" | "states" | "excludeDraft"
      >
    ): Promise<Purpose[]> {
      return (
        await purposeReadModelServiceSQL.getPurposesByFilter(
          and(...getPurposesFilters(readModelDB, filters))
        )
      ).map((d) => d.data);
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
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
