import { ilike, inArray, or, SQL, and, eq, sql } from "drizzle-orm";
import {
  Agreement,
  AttributeId,
  AgreementState,
  Attribute,
  DescriptorId,
  EService,
  ListResult,
  Tenant,
  WithMetadata,
  EServiceId,
  TenantId,
  Delegation,
  AgreementId,
  delegationKind,
  delegationState,
  agreementState,
  descriptorState,
} from "pagopa-interop-models";
import {
  aggregateAgreementArray,
  AgreementReadModelService,
  AttributeReadModelService,
  CatalogReadModelService,
  DelegationReadModelService,
  TenantReadModelService,
  toAgreementAggregatorArray,
} from "pagopa-interop-readmodel";
import {
  agreementInReadmodelAgreement,
  agreementAttributeInReadmodelAgreement,
  agreementConsumerDocumentInReadmodelAgreement,
  agreementContractInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  delegationInReadmodelDelegation,
  DrizzleReturnType,
  eserviceDescriptorInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  tenantInReadmodelTenant,
  EServiceDescriptorSQL,
} from "pagopa-interop-readmodel-models";
import { escapeRegExp, createListResult } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { PgSelect } from "drizzle-orm/pg-core";
import {
  CompactEService,
  CompactOrganization,
} from "../model/domain/models.js";

export type AgreementQueryFilters = {
  producerId?: TenantId | TenantId[];
  consumerId?: TenantId | TenantId[];
  eserviceId?: EServiceId | EServiceId[];
  descriptorId?: DescriptorId | DescriptorId[];
  agreementStates?: AgreementState[];
  attributeId?: AttributeId | AttributeId[];
  showOnlyUpgradeable?: boolean;
};

export type AgreementEServicesQueryFilters = {
  eserviceName: string | undefined;
  consumerIds: TenantId[];
  producerIds: TenantId[];
};

const delegationsJoinConditions = (
  agreementTable: typeof agreementInReadmodelAgreement,
  delegationTable: typeof delegationInReadmodelDelegation
): SQL<unknown> | undefined =>
  and(
    eq(delegationTable.eserviceId, agreementTable.eserviceId),
    or(
      and(
        eq(delegationTable.delegatorId, agreementTable.consumerId),
        eq(delegationTable.kind, delegationKind.delegatedConsumer)
      ),
      and(
        eq(delegationTable.delegatorId, agreementTable.producerId),
        eq(delegationTable.kind, delegationKind.delegatedProducer)
      )
    )
  );

const delegationsVisibilityConditions = (
  requesterId: TenantId,
  agreementTable: typeof agreementInReadmodelAgreement,
  delegationTable: typeof delegationInReadmodelDelegation
): SQL<unknown> | undefined =>
  or(
    // REQ IS PRODUCER
    eq(agreementTable.producerId, requesterId),
    // REQ IS CONSUMER
    eq(agreementTable.consumerId, requesterId),
    // REQ IS DELEGATE AS PRODUCER
    and(
      eq(delegationTable.delegateId, requesterId),
      eq(delegationTable.kind, delegationKind.delegatedProducer),
      eq(delegationTable.state, delegationState.active)
    ),
    // REQ IS DELEGATE AS CONSUMER
    and(
      eq(delegationTable.delegateId, requesterId),
      eq(delegationTable.kind, delegationKind.delegatedConsumer),
      eq(delegationTable.state, delegationState.active)
    )
  );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const withPagination = <T extends PgSelect>(
  qb: T,
  limit: number,
  offset: number
) => qb.limit(limit).offset(offset);

async function filterAgreementsUpgradeable(
  agreementEserviceAndDescriptors: Array<{
    agreementId: string;
    agreementDescriptorId: string;
    eserviceId: string | null;
    descriptor: EServiceDescriptorSQL | null;
  }>,
  agreements: Agreement[],
  offset: number,
  limit: number
): Promise<ListResult<Agreement>> {
  const agreementEserviceGroupedDescriptors = Array.from(
    agreementEserviceAndDescriptors
      .reduce(
        (
          map,
          { agreementId, agreementDescriptorId, eserviceId, descriptor }
        ) => {
          if (!eserviceId || !descriptor) {
            return map;
          }
          if (!map.has(agreementId)) {
            map.set(agreementId, {
              agreementId,
              agreementDescriptorId,
              eserviceId,
              descriptors: [],
            });
          }
          // eslint-disable-next-line functional/immutable-data
          map.get(agreementId)?.descriptors.push(descriptor);
          return map;
        },
        new Map<
          string,
          {
            agreementId: string;
            agreementDescriptorId: string;
            eserviceId: string;
            descriptors: EServiceDescriptorSQL[];
          }
        >()
      )
      .values()
  );
  const agreementsUpgradableIds: string[] = agreementEserviceGroupedDescriptors
    .filter(({ agreementDescriptorId, descriptors }) => {
      const currentDescriptor = descriptors.find(
        (descr) => descr.id === agreementDescriptorId
      );
      const upgradableDescriptor = descriptors.filter((upgradable) => {
        // Since the dates are optional, if they are undefined they are set to a very old date
        const currentPublishedAt =
          currentDescriptor?.publishedAt ?? new Date(0);
        const upgradablePublishedAt = upgradable.publishedAt ?? new Date(0);
        return (
          upgradablePublishedAt > currentPublishedAt &&
          (upgradable.state === descriptorState.published ||
            upgradable.state === descriptorState.suspended)
        );
      });
      return upgradableDescriptor.length > 0;
    })
    .map((item) => item.agreementId);

  const upgradableAgreements = agreements
    .filter((agreement) =>
      agreementsUpgradableIds.some((id) => agreement.id === id)
    )
    .slice(offset, offset + limit);

  return createListResult(upgradableAgreements, upgradableAgreements.length);
}

const toArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const explicitFilters = (
  filters: AgreementQueryFilters
): {
  producerIds: TenantId[];
  consumerIds: TenantId[];
  eserviceIds: EServiceId[];
  descriptorIds: DescriptorId[];
  attributeIds: AttributeId[];
  states: AgreementState[];
  showOnlyUpgradeable: boolean;
} => {
  const {
    producerId,
    consumerId,
    eserviceId,
    descriptorId,
    agreementStates,
    attributeId,
    showOnlyUpgradeable,
  } = filters;

  const producerIds = toArray(producerId);
  const consumerIds = toArray(consumerId);
  const eserviceIds = toArray(eserviceId);
  const descriptorIds = toArray(descriptorId);
  const attributeIds = toArray(attributeId);

  const upgradeableStates = [
    agreementState.draft,
    agreementState.active,
    agreementState.suspended,
  ];
  const states = match(agreementStates)
    .with(P.nullish, () => (showOnlyUpgradeable ? upgradeableStates : []))
    .with(
      P.when(
        (agreementStates) => agreementStates.length === 0 && showOnlyUpgradeable
      ),
      () => upgradeableStates
    )
    .with(
      P.when(
        (agreementStates) => agreementStates.length > 0 && showOnlyUpgradeable
      ),
      (agreementStates) =>
        upgradeableStates.filter((s) => agreementStates.includes(s))
    )
    .otherwise((agreementStates) => agreementStates);

  return {
    producerIds,
    consumerIds,
    eserviceIds,
    descriptorIds,
    attributeIds,
    states,
    showOnlyUpgradeable: showOnlyUpgradeable === true,
  };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-params
export function readModelServiceBuilderSQL(
  readmodelDB: DrizzleReturnType,
  agreementReadModelServiceSQL: AgreementReadModelService,
  catalogReadModelServiceSQL: CatalogReadModelService,
  tenantReadModelServiceSQL: TenantReadModelService,
  attributeReadModelServiceSQL: AttributeReadModelService,
  delegationReadModelServiceSQL: DelegationReadModelService
) {
  return {
    async getAgreements(
      requesterId: TenantId,
      filters: AgreementQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<Agreement>> {
      const {
        producerIds,
        consumerIds,
        eserviceIds,
        descriptorIds,
        attributeIds,
        states,
        showOnlyUpgradeable,
      } = explicitFilters(filters);

      const queryBaseAgreementIds = readmodelDB
        .select({
          id: agreementInReadmodelAgreement.id,
          eserviceName: eserviceInReadmodelCatalog.name,
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
        })
        .from(agreementInReadmodelAgreement)
        .leftJoin(
          eserviceInReadmodelCatalog,
          eq(
            agreementInReadmodelAgreement.eserviceId,
            eserviceInReadmodelCatalog.id
          )
        )
        .leftJoin(
          eserviceDescriptorInReadmodelCatalog,
          eq(
            agreementInReadmodelAgreement.descriptorId,
            eserviceDescriptorInReadmodelCatalog.id
          )
        )
        .leftJoin(
          agreementAttributeInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementAttributeInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          // DELEGATION
          delegationInReadmodelDelegation,
          delegationsJoinConditions(
            agreementInReadmodelAgreement,
            delegationInReadmodelDelegation
          )
        )
        .where(
          and(
            // VISIBILITY
            delegationsVisibilityConditions(
              requesterId,
              agreementInReadmodelAgreement,
              delegationInReadmodelDelegation
            ),
            // END // VISIBILITY
            // PRODUCERS
            producerIds.length > 0
              ? or(
                  inArray(
                    agreementInReadmodelAgreement.producerId,
                    producerIds
                  ),
                  inArray(
                    delegationInReadmodelDelegation.delegateId,
                    producerIds
                  )
                )
              : undefined,
            // END PRODUCERS
            // CONSUMERS
            consumerIds.length > 0
              ? or(
                  inArray(
                    agreementInReadmodelAgreement.consumerId,
                    consumerIds
                  ),
                  inArray(
                    delegationInReadmodelDelegation.delegateId,
                    consumerIds
                  )
                )
              : undefined,
            // END CONSUMERS
            // ESERVICES
            eserviceIds.length > 0
              ? or(
                  inArray(agreementInReadmodelAgreement.eserviceId, eserviceIds)
                )
              : undefined,
            // END ESERVICES
            // DESCRIPTORS
            descriptorIds.length > 0
              ? or(
                  inArray(
                    agreementInReadmodelAgreement.descriptorId,
                    descriptorIds
                  )
                )
              : undefined,
            // END DESCRIPTORS
            // ATTRIBUTES
            attributeIds.length > 0
              ? or(
                  inArray(
                    agreementAttributeInReadmodelAgreement.attributeId,
                    attributeIds
                  )
                )
              : undefined,
            // END ATTRIBUTES
            // AGREEMENT STATES
            states && states.length > 0
              ? or(inArray(agreementInReadmodelAgreement.state, states))
              : undefined
            // END AGREEMENT STATES
          )
        )
        .groupBy(
          agreementInReadmodelAgreement.id,
          eserviceInReadmodelCatalog.name
        )
        .orderBy(
          sql`LOWER(${eserviceInReadmodelCatalog.name}), ${agreementInReadmodelAgreement.id}`
        );

      const dynamicQueryAgreements = queryBaseAgreementIds.$dynamic();
      const queryAgreementIds = showOnlyUpgradeable
        ? dynamicQueryAgreements.as("queryAgreementIds")
        : withPagination(dynamicQueryAgreements, limit, offset).as(
            "queryAgreementIds"
          );

      const resultSet = await readmodelDB
        .select({
          eserviceName: queryAgreementIds.eserviceName,
          agreement: agreementInReadmodelAgreement,
          attribute: agreementAttributeInReadmodelAgreement,
          consumerDocument: agreementConsumerDocumentInReadmodelAgreement,
          contract: agreementContractInReadmodelAgreement,
          stamp: agreementStampInReadmodelAgreement,
          totalCount: queryAgreementIds.totalCount,
        })
        .from(agreementInReadmodelAgreement)
        .innerJoin(
          queryAgreementIds,
          eq(agreementInReadmodelAgreement.id, queryAgreementIds.id)
        )
        .leftJoin(
          agreementAttributeInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementAttributeInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementConsumerDocumentInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementConsumerDocumentInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementContractInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementContractInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementStampInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementStampInReadmodelAgreement.agreementId
          )
        );

      const agreements = aggregateAgreementArray(
        toAgreementAggregatorArray(resultSet)
      ).map(({ data }) => data);

      if (showOnlyUpgradeable) {
        const agreementEserviceAndDescriptors = await readmodelDB
          .select({
            agreementId: agreementInReadmodelAgreement.id,
            agreementDescriptorId: agreementInReadmodelAgreement.descriptorId,
            eserviceId: eserviceInReadmodelCatalog.id,
            descriptor: eserviceDescriptorInReadmodelCatalog,
          })
          .from(agreementInReadmodelAgreement)
          .innerJoin(
            queryAgreementIds,
            eq(agreementInReadmodelAgreement.id, queryAgreementIds.id)
          )
          .leftJoin(
            eserviceInReadmodelCatalog,
            eq(
              eserviceInReadmodelCatalog.id,
              agreementInReadmodelAgreement.eserviceId
            )
          )
          .leftJoin(
            eserviceDescriptorInReadmodelCatalog,
            eq(
              eserviceDescriptorInReadmodelCatalog.eserviceId,
              agreementInReadmodelAgreement.eserviceId
            )
          );
        return await filterAgreementsUpgradeable(
          agreementEserviceAndDescriptors,
          agreements,
          offset,
          limit
        );
      }
      return createListResult(agreements, resultSet[0]?.totalCount);
    },

    async getAgreementById(
      agreementId: AgreementId
    ): Promise<WithMetadata<Agreement> | undefined> {
      return await agreementReadModelServiceSQL.getAgreementById(agreementId);
    },

    async getAllAgreements(
      filters: AgreementQueryFilters
    ): Promise<Array<WithMetadata<Agreement>>> {
      const {
        producerIds,
        consumerIds,
        eserviceIds,
        descriptorIds,
        attributeIds,
        states,
      } = explicitFilters(filters);

      const queryBaseAgreementIds = readmodelDB
        .select({
          id: agreementInReadmodelAgreement.id,
          eserviceName: eserviceInReadmodelCatalog.name,
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number).as("totalCount"),
        })
        .from(agreementInReadmodelAgreement)
        .leftJoin(
          eserviceInReadmodelCatalog,
          eq(
            agreementInReadmodelAgreement.eserviceId,
            eserviceInReadmodelCatalog.id
          )
        )
        .leftJoin(
          eserviceDescriptorInReadmodelCatalog,
          eq(
            agreementInReadmodelAgreement.descriptorId,
            eserviceDescriptorInReadmodelCatalog.id
          )
        )
        .leftJoin(
          agreementAttributeInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementAttributeInReadmodelAgreement.agreementId
          )
        )
        .where(
          and(
            // PRODUCERS
            producerIds.length > 0
              ? inArray(agreementInReadmodelAgreement.producerId, producerIds)
              : undefined,
            // END PRODUCERS
            // CONSUMERS
            consumerIds.length > 0
              ? inArray(agreementInReadmodelAgreement.consumerId, consumerIds)
              : undefined,
            // END CONSUMERS
            // ESERVICES
            eserviceIds.length > 0
              ? or(
                  inArray(agreementInReadmodelAgreement.eserviceId, eserviceIds)
                )
              : undefined,
            // END ESERVICES
            // DESCRIPTORS
            descriptorIds.length > 0
              ? or(
                  inArray(
                    agreementInReadmodelAgreement.descriptorId,
                    descriptorIds
                  )
                )
              : undefined,
            // END DESCRIPTORS
            // ATTRIBUTES
            attributeIds.length > 0
              ? or(
                  inArray(
                    agreementAttributeInReadmodelAgreement.attributeId,
                    attributeIds
                  )
                )
              : undefined,
            // END ATTRIBUTES
            // AGREEMENT STATES
            states && states.length > 0
              ? or(inArray(agreementInReadmodelAgreement.state, states))
              : undefined
            // END AGREEMENT STATES
          )
        )
        .groupBy(
          agreementInReadmodelAgreement.id,
          eserviceInReadmodelCatalog.name
        )
        .orderBy(
          sql`LOWER(${eserviceInReadmodelCatalog.name}), ${agreementInReadmodelAgreement.id}`
        );

      const queryAgreementIds = queryBaseAgreementIds.as("queryAgreementIds");

      const resultSet = await readmodelDB
        .select({
          eserviceName: queryAgreementIds.eserviceName,
          agreement: agreementInReadmodelAgreement,
          attribute: agreementAttributeInReadmodelAgreement,
          consumerDocument: agreementConsumerDocumentInReadmodelAgreement,
          contract: agreementContractInReadmodelAgreement,
          stamp: agreementStampInReadmodelAgreement,
          totalCount: queryAgreementIds.totalCount,
        })
        .from(agreementInReadmodelAgreement)
        .innerJoin(
          queryAgreementIds,
          eq(agreementInReadmodelAgreement.id, queryAgreementIds.id)
        )
        .leftJoin(
          agreementAttributeInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementAttributeInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementConsumerDocumentInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementConsumerDocumentInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementContractInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementContractInReadmodelAgreement.agreementId
          )
        )
        .leftJoin(
          agreementStampInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementStampInReadmodelAgreement.agreementId
          )
        );

      return aggregateAgreementArray(toAgreementAggregatorArray(resultSet));
    },

    async getEServiceById(
      eserviceId: EServiceId
    ): Promise<EService | undefined> {
      return (await catalogReadModelServiceSQL.getEServiceById(eserviceId))
        ?.data;
    },

    async getTenantById(tenantId: TenantId): Promise<Tenant | undefined> {
      return (await tenantReadModelServiceSQL.getTenantById(tenantId))?.data;
    },

    async getAttributeById(
      attributeId: AttributeId
    ): Promise<Attribute | undefined> {
      const attributeWithMetadata =
        await attributeReadModelServiceSQL.getAttributeById(attributeId);
      return attributeWithMetadata?.data;
    },

    async getAgreementsConsumers(
      requesterId: TenantId,
      consumerName: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      const resultSet = await readmodelDB
        .selectDistinct({
          id: tenantInReadmodelTenant.id,
          name: tenantInReadmodelTenant.name,
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number),
        })
        .from(tenantInReadmodelTenant)
        .leftJoin(
          agreementInReadmodelAgreement,
          eq(
            tenantInReadmodelTenant.id,
            agreementInReadmodelAgreement.consumerId
          )
        )
        .leftJoin(
          // DELEGATION
          delegationInReadmodelDelegation,
          delegationsJoinConditions(
            agreementInReadmodelAgreement,
            delegationInReadmodelDelegation
          )
        )
        .where(
          and(
            // FILTER NAME
            consumerName
              ? ilike(
                  tenantInReadmodelTenant.name,
                  `%${escapeRegExp(consumerName)}%`
                )
              : undefined,
            // VISIBILITY
            delegationsVisibilityConditions(
              requesterId,
              agreementInReadmodelAgreement,
              delegationInReadmodelDelegation
            )
            // END // VISIBILITY
          )
        )
        .groupBy(tenantInReadmodelTenant.id)
        .orderBy(tenantInReadmodelTenant.name)
        .limit(limit)
        .offset(offset);
      return createListResult(
        resultSet.map(({ id, name }) => ({ id, name })),
        resultSet[0]?.totalCount
      );
    },

    async getAgreementsProducers(
      requesterId: TenantId,
      producerName: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      const resultSet = await readmodelDB
        .selectDistinct({
          id: tenantInReadmodelTenant.id,
          name: tenantInReadmodelTenant.name,
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number),
        })
        .from(tenantInReadmodelTenant)
        .leftJoin(
          agreementInReadmodelAgreement,
          eq(
            tenantInReadmodelTenant.id,
            agreementInReadmodelAgreement.producerId
          )
        )
        .leftJoin(
          // DELEGATION
          delegationInReadmodelDelegation,
          delegationsJoinConditions(
            agreementInReadmodelAgreement,
            delegationInReadmodelDelegation
          )
        )
        .where(
          and(
            // FILTER NAME
            producerName
              ? ilike(
                  tenantInReadmodelTenant.name,
                  `%${escapeRegExp(producerName)}%`
                )
              : undefined,
            // VISIBILITY
            delegationsVisibilityConditions(
              requesterId,
              agreementInReadmodelAgreement,
              delegationInReadmodelDelegation
            )
            // END // VISIBILITY
          )
        )
        .groupBy(tenantInReadmodelTenant.id)
        .orderBy(tenantInReadmodelTenant.name)
        .limit(limit)
        .offset(offset);
      return createListResult(
        resultSet.map(({ id, name }) => ({ id, name })),
        resultSet[0]?.totalCount
      );
    },

    async getAgreementsEServices(
      requesterId: TenantId,
      filters: AgreementEServicesQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactEService>> {
      const { consumerIds, producerIds, eserviceName } = filters;
      const resultSet = await readmodelDB
        .selectDistinct({
          id: eserviceInReadmodelCatalog.id,
          name: eserviceInReadmodelCatalog.name,
          totalCount: sql`COUNT(*) OVER()`.mapWith(Number),
        })
        .from(eserviceInReadmodelCatalog)
        .leftJoin(
          agreementInReadmodelAgreement,
          and(
            eq(
              eserviceInReadmodelCatalog.id,
              agreementInReadmodelAgreement.eserviceId
            )
          )
        )
        .leftJoin(
          // DELEGATION
          delegationInReadmodelDelegation,
          delegationsJoinConditions(
            agreementInReadmodelAgreement,
            delegationInReadmodelDelegation
          )
        )
        .where(
          and(
            // FILTER NAME
            eserviceName
              ? ilike(eserviceInReadmodelCatalog.name, `%${eserviceName}%`)
              : undefined,
            // FILTER PRODUCER
            producerIds.length > 0
              ? or(
                  inArray(
                    agreementInReadmodelAgreement.producerId,
                    producerIds
                  ),
                  and(
                    inArray(
                      delegationInReadmodelDelegation.delegateId,
                      producerIds
                    ),
                    eq(
                      delegationInReadmodelDelegation.state,
                      delegationState.active
                    ),
                    eq(
                      delegationInReadmodelDelegation.kind,
                      delegationKind.delegatedProducer
                    )
                  )
                )
              : undefined,
            // FILTER CONSUMER
            consumerIds.length > 0
              ? or(
                  inArray(
                    agreementInReadmodelAgreement.consumerId,
                    consumerIds
                  ),
                  and(
                    inArray(
                      delegationInReadmodelDelegation.delegateId,
                      consumerIds
                    ),
                    eq(
                      delegationInReadmodelDelegation.state,
                      delegationState.active
                    ),
                    eq(
                      delegationInReadmodelDelegation.kind,
                      delegationKind.delegatedConsumer
                    )
                  )
                )
              : undefined,
            // VISIBILITY
            delegationsVisibilityConditions(
              requesterId,
              agreementInReadmodelAgreement,
              delegationInReadmodelDelegation
            )
            // END // VISIBILITY
          )
        )
        .groupBy(eserviceInReadmodelCatalog.id)
        .orderBy(eserviceInReadmodelCatalog.name)
        .limit(limit)
        .offset(offset);
      return createListResult(
        resultSet.map(({ id, name }) => ({ id, name })),
        resultSet[0]?.totalCount
      );
    },

    async getActiveProducerDelegationByEserviceId(
      eserviceId: EServiceId
    ): Promise<Delegation | undefined> {
      const delegation =
        await delegationReadModelServiceSQL.getDelegationByFilter(
          and(
            eq(delegationInReadmodelDelegation.eserviceId, eserviceId),
            eq(delegationInReadmodelDelegation.state, delegationState.active),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedProducer
            )
          )
        );
      return delegation?.data;
    },

    async getActiveConsumerDelegationsByEserviceId(
      eserviceId: EServiceId
    ): Promise<Delegation[]> {
      const delegations =
        await delegationReadModelServiceSQL.getDelegationsByFilter(
          and(
            eq(delegationInReadmodelDelegation.eserviceId, eserviceId),
            eq(delegationInReadmodelDelegation.state, delegationState.active),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedConsumer
            )
          )
        );
      return delegations.map(({ data }) => data);
    },

    async getActiveConsumerDelegationByAgreement(
      agreement: Pick<Agreement, "consumerId" | "eserviceId">
    ): Promise<Delegation | undefined> {
      const delegation =
        await delegationReadModelServiceSQL.getDelegationByFilter(
          and(
            eq(
              delegationInReadmodelDelegation.eserviceId,
              agreement.eserviceId
            ),
            eq(
              delegationInReadmodelDelegation.delegatorId,
              agreement.consumerId
            ),
            eq(delegationInReadmodelDelegation.state, delegationState.active),
            eq(
              delegationInReadmodelDelegation.kind,
              delegationKind.delegatedConsumer
            )
          )
        );
      return delegation?.data;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
