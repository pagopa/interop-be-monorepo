import { ReadModelRepository } from "pagopa-interop-commons";
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
  DrizzleTransactionType,
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
  sql,
  SQL,
} from "drizzle-orm";

export type GetPurposesFilters = {
  title?: string;
  eservicesIds: EServiceId[];
  consumersIds: TenantId[];
  producersIds: TenantId[];
  states: PurposeVersionState[];
  excludeDraft: boolean | undefined;
};

// function getConsumerOrDelegateFilter(
//   readModelDB: DrizzleReturnType,
//   consumerIds: TenantId[]
// ): SQL | undefined {
//   return consumerIds && consumerIds.length > 0
//     ? or(
//         inArray(purposeInReadmodelPurpose.consumerId, consumerIds),
//         inArray(
//           delegationInReadmodelDelegation.delegateId,
//           addConsumerDelegationData(readModelDB, consumerIds)
//         )
//       )
//     : undefined;
// }

// function getProducerOrDelegateFilter(
//   readModelDB: DrizzleReturnType,
//   producerIds: TenantId[]
// ): SQL | undefined {
//   return producerIds && producerIds.length > 0
//     ? or(
//         inArray(eserviceInReadmodelCatalog.producerId, producerIds),
//         inArray(
//           delegationInReadmodelDelegation.delegateId,
//           addProducerDelegationData(readModelDB, producerIds)
//         )
//       )
//     : undefined;
// }

const addProducerDelegationData = (
  readModelDB: DrizzleTransactionType,
  producerIds: TenantId[]
) =>
  readModelDB
    .select({
      delegateId: delegationInReadmodelDelegation.delegateId,
    })
    .from(delegationInReadmodelDelegation)

    .where(
      and(
        eq(
          delegationInReadmodelDelegation.kind,
          delegationKind.delegatedProducer
        ),
        eq(delegationInReadmodelDelegation.state, delegationState.active),
        inArray(delegationInReadmodelDelegation.delegateId, producerIds)
      )
    );
// .as("producerDelegationData");

const addConsumerDelegationData = (
  readModelDB: DrizzleTransactionType,
  consumerIds: TenantId[]
) =>
  readModelDB
    .select({
      // TODO: double check delegatorId or delegateId?
      delegatorId: delegationInReadmodelDelegation.delegatorId,
    })
    .from(purposeInReadmodelPurpose)
    .innerJoin(
      delegationInReadmodelDelegation,
      eq(
        purposeInReadmodelPurpose.delegationId,
        delegationInReadmodelDelegation.id
      )
    )
    .where(
      and(
        eq(
          delegationInReadmodelDelegation.kind,
          delegationKind.delegatedConsumer
        ),
        eq(delegationInReadmodelDelegation.state, delegationState.active),
        // TODO: wrong?
        inArray(delegationInReadmodelDelegation.delegatorId, consumerIds),
        eq(
          purposeInReadmodelPurpose.delegationId,
          delegationInReadmodelDelegation.id
        )
      )
    );

// function applyVisibilityToPurposes(
//   readModelDB: DrizzleReturnType,
//   requesterId: TenantId
// ): SQL {
//   return or(
//     eq(eserviceInReadmodelCatalog.producerId, requesterId),
//     eq(purposeInReadmodelPurpose.consumerId, requesterId),
//     inArray(
//       delegationInReadmodelDelegation.delegateId,
//       addProducerDelegationData(readModelDB, [requesterId])
//     ),
//     inArray(
//       delegationInReadmodelDelegation.delegateId,
//       addConsumerDelegationData(readModelDB, [requesterId])
//     )
//   ) as SQL;
// }

// const getPurposesPipeline = (
//   readModelDB: DrizzleReturnType,
//   requesterId: TenantId,
//   producerIds: TenantId[] = [],
//   consumerIds: TenantId[] = []
// ): Array<SQL | undefined> => [
//   // ...addDelegationDataPipeline,
//   getProducerOrDelegateFilter(readModelDB, producerIds),
//   getConsumerOrDelegateFilter(readModelDB, consumerIds),
//   applyVisibilityToPurposes(readModelDB, requesterId),
// ];

function getPurposesFilters(
  db: DrizzleReturnType | DrizzleTransactionType,
  filters: Pick<
    GetPurposesFilters,
    "title" | "eservicesIds" | "states" | "excludeDraft"
  >
): Array<SQL | undefined> {
  const { title, eservicesIds, states, excludeDraft } = filters;
  const titleFilter = title
    ? ilike(
        purposeInReadmodelPurpose.title,
        `%${ReadModelRepository.escapeRegExp(title)}%`
      )
    : undefined;

  const eservicesIdsFilter = eservicesIds?.length
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
      return (
        await purposeReadModelServiceSQL.getPurposeByFilter(
          and(
            eq(purposeInReadmodelPurpose.eserviceId, eserviceId),
            eq(purposeInReadmodelPurpose.consumerId, consumerId),
            ilike(purposeInReadmodelPurpose.title, title)
          ) as SQL
        )
      )[0];
    },
    async getPurposes(
      requesterId: TenantId,
      filters: GetPurposesFilters,
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ListResult<Purpose>> {
      const { producersIds, consumersIds, ...otherFilters } = filters;

      const queryResult = await readModelDB.transaction(async (tx) => {
        const subQuery = tx
          .select({
            purposeId: purposeInReadmodelPurpose.id,
            totalCount: sql`COUNT(*) OVER()`.as("totalCount"),
          })
          .from(purposeInReadmodelPurpose)
          .leftJoin(
            purposeVersionInReadmodelPurpose,
            eq(
              purposeInReadmodelPurpose.id,
              purposeVersionInReadmodelPurpose.purposeId
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
          .where(
            // PRODUCER IDS
            and(
              producersIds.length > 0
                ? or(
                    inArray(
                      eserviceInReadmodelCatalog.producerId,
                      producersIds
                    ),
                    inArray(
                      delegationInReadmodelDelegation.delegateId,
                      producersIds
                    )
                  )
                : undefined,
              // CONSUMER IDS
              consumersIds.length > 0
                ? or(
                    inArray(purposeInReadmodelPurpose.consumerId, consumersIds),
                    inArray(
                      delegationInReadmodelDelegation.delegateId,
                      consumersIds
                    )
                  )
                : undefined,
              // VISIBILITY
              or(
                eq(eserviceInReadmodelCatalog.producerId, requesterId),
                eq(purposeInReadmodelPurpose.consumerId, requesterId),
                and(
                  eq(delegationInReadmodelDelegation.delegateId, requesterId),
                  eq(
                    delegationInReadmodelDelegation.kind,
                    delegationKind.delegatedProducer
                  )
                ),
                and(
                  eq(delegationInReadmodelDelegation.delegateId, requesterId),
                  eq(
                    purposeInReadmodelPurpose.delegationId,
                    delegationInReadmodelDelegation.id
                  ),
                  isNotNull(delegationInReadmodelDelegation.delegateId)
                )
              ),
              // PURPOSE FILTERS
              ...getPurposesFilters(tx, otherFilters)
            )
          )
          .groupBy(purposeInReadmodelPurpose.id)
          .limit(limit)
          .offset(offset)
          .orderBy(sql`LOWER(${purposeInReadmodelPurpose.title})`)
          .as("subQuery");

        return await tx
          .select({
            purpose: purposeInReadmodelPurpose,
            purposeRiskAnalysisForm: purposeRiskAnalysisFormInReadmodelPurpose,
            purposeRiskAnalysisAnswer:
              purposeRiskAnalysisAnswerInReadmodelPurpose,
            purposeVersion: purposeVersionInReadmodelPurpose,
            purposeVersionDocument: purposeVersionDocumentInReadmodelPurpose,
            totalCount: subQuery.totalCount,
          })
          .from(purposeInReadmodelPurpose)
          .innerJoin(
            subQuery,
            eq(purposeInReadmodelPurpose.id, subQuery.purposeId)
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
          );
      });

      return {
        results: aggregatePurposeArray(
          toPurposeAggregatorArray(queryResult)
        ).map((p) => p.data),
        totalCount: Number(queryResult[0]?.totalCount ?? 0),
      };
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
          ) as SQL
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
        await purposeReadModelServiceSQL.getPurposeByFilter(
          and(...getPurposesFilters(readModelDB, filters))
        )
      ).map((d) => d.data);

      // TODO: safeParse?
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
          ) as SQL
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
          ) as SQL
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
          ) as SQL
        )
      )?.data;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
