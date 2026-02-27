import { ilike, inArray, or, and, eq, SQL, asc } from "drizzle-orm";
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
  AgreementDocument,
  unsafeBrandId,
  AgreementDocumentId,
  stringToDate,
  CompactOrganization,
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
  agreementSignedContractInReadmodelAgreement,
} from "pagopa-interop-readmodel-models";
import {
  escapeRegExp,
  createListResult,
  ascLower,
  withTotalCount,
  getTableTotalCount,
} from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { alias, PgColumn, PgSelect } from "drizzle-orm/pg-core";
import { CompactEService } from "../model/domain/models.js";

type AgreementQueryFilters = {
  producerId?: TenantId | TenantId[];
  consumerId?: TenantId | TenantId[];
  eserviceId?: EServiceId | EServiceId[];
  descriptorId?: DescriptorId | DescriptorId[];
  agreementStates?: AgreementState[];
  attributeId?: AttributeId | AttributeId[];
  showOnlyUpgradeable?: boolean;
};

type AgreementEServicesQueryFilters = {
  eserviceName: string | undefined;
  consumerIds: TenantId[];
  producerIds: TenantId[];
};

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

const activeProducerDelegations = alias(
  delegationInReadmodelDelegation,
  "activeProducerDelegations"
);
const activeConsumerDelegations = alias(
  delegationInReadmodelDelegation,
  "activeConsumerDelegations"
);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const addDelegationJoins = <T extends PgSelect>(query: T) =>
  query
    .leftJoin(
      activeProducerDelegations,
      and(
        eq(
          agreementInReadmodelAgreement.eserviceId,
          activeProducerDelegations.eserviceId
        ),
        eq(activeProducerDelegations.state, delegationState.active),
        eq(activeProducerDelegations.kind, delegationKind.delegatedProducer),
        eq(
          activeProducerDelegations.delegatorId,
          agreementInReadmodelAgreement.producerId
        )
      )
    )
    .leftJoin(
      activeConsumerDelegations,
      and(
        eq(
          agreementInReadmodelAgreement.eserviceId,
          activeConsumerDelegations.eserviceId
        ),
        eq(activeConsumerDelegations.state, delegationState.active),
        eq(activeConsumerDelegations.kind, delegationKind.delegatedConsumer),
        eq(
          activeConsumerDelegations.delegatorId,
          agreementInReadmodelAgreement.consumerId
        )
      )
    );

const getVisibilityFilter = (requesterId: TenantId): SQL | undefined =>
  or(
    eq(agreementInReadmodelAgreement.producerId, requesterId),
    eq(agreementInReadmodelAgreement.consumerId, requesterId),
    eq(activeProducerDelegations.delegateId, requesterId),
    eq(activeConsumerDelegations.delegateId, requesterId)
  );

const getProducerIdsFilter = (
  producerIds: TenantId[],
  withDelegationFilter: boolean | undefined
): SQL | undefined =>
  producerIds.length > 0
    ? or(
        inArray(agreementInReadmodelAgreement.producerId, producerIds),
        withDelegationFilter
          ? inArray(activeProducerDelegations.delegateId, producerIds)
          : undefined
      )
    : undefined;

const getConsumerIdsFilter = (
  consumerIds: TenantId[],
  withDelegationFilter: boolean | undefined
): SQL | undefined =>
  consumerIds.length > 0
    ? or(
        inArray(agreementInReadmodelAgreement.consumerId, consumerIds),
        withDelegationFilter
          ? inArray(activeConsumerDelegations.delegateId, consumerIds)
          : undefined
      )
    : undefined;

const getEServiceIdsFilter = (eserviceIds: EServiceId[]): SQL | undefined =>
  eserviceIds.length > 0
    ? inArray(agreementInReadmodelAgreement.eserviceId, eserviceIds)
    : undefined;

const getDescriptorIdsFilter = (
  descriptorIds: DescriptorId[]
): SQL | undefined =>
  descriptorIds.length > 0
    ? inArray(agreementInReadmodelAgreement.descriptorId, descriptorIds)
    : undefined;

const getAttributeIdsFilter = (attributeIds: AttributeId[]): SQL | undefined =>
  attributeIds.length > 0
    ? inArray(agreementAttributeInReadmodelAgreement.attributeId, attributeIds)
    : undefined;

const getAgreementStatesFilter = (states: AgreementState[]): SQL | undefined =>
  states && states.length > 0
    ? inArray(agreementInReadmodelAgreement.state, states)
    : undefined;

const getNameFilter = (
  column: PgColumn,
  comparisonName: string | undefined
): SQL | undefined =>
  comparisonName !== undefined
    ? ilike(column, `%${escapeRegExp(comparisonName)}%`)
    : undefined;

const getAgreementsFilters = <
  T extends
    | { requesterId: TenantId; withVisibilityAndDelegationFilters: true }
    | {
        requesterId?: never;
        withVisibilityAndDelegationFilters?: never;
      },
>({
  filters,
  requesterId,
  withVisibilityAndDelegationFilters,
}: {
  filters: AgreementQueryFilters;
} & T): SQL | undefined => {
  const {
    producerIds,
    consumerIds,
    eserviceIds,
    descriptorIds,
    attributeIds,
    states,
  } = explicitFilters(filters);

  return and(
    withVisibilityAndDelegationFilters
      ? getVisibilityFilter(requesterId)
      : undefined,
    getProducerIdsFilter(producerIds, withVisibilityAndDelegationFilters),
    getConsumerIdsFilter(consumerIds, withVisibilityAndDelegationFilters),
    getEServiceIdsFilter(eserviceIds),
    getDescriptorIdsFilter(descriptorIds),
    getAttributeIdsFilter(attributeIds),
    getAgreementStatesFilter(states)
  );
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
      const queryBaseAgreementIds = addDelegationJoins(
        readmodelDB
          .select({
            id: agreementInReadmodelAgreement.id,
            eserviceName: eserviceInReadmodelCatalog.name,
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
            getAgreementsFilters({
              filters,
              requesterId,
              withVisibilityAndDelegationFilters: true,
            })
          )
          .groupBy(
            agreementInReadmodelAgreement.id,
            eserviceInReadmodelCatalog.name
          )
          .orderBy(
            ascLower(eserviceInReadmodelCatalog.name),
            agreementInReadmodelAgreement.id
          )
          .$dynamic()
      );

      const queryAgreementIds = filters.showOnlyUpgradeable
        ? queryBaseAgreementIds.as("queryAgreementIds")
        : queryBaseAgreementIds
            .limit(limit)
            .offset(offset)
            .as("queryAgreementIds");

      const outerQuery = readmodelDB
        .select({
          eserviceName: queryAgreementIds.eserviceName,
          agreement: agreementInReadmodelAgreement,
          attribute: agreementAttributeInReadmodelAgreement,
          consumerDocument: agreementConsumerDocumentInReadmodelAgreement,
          contract: agreementContractInReadmodelAgreement,
          stamp: agreementStampInReadmodelAgreement,
          signedContract: agreementSignedContractInReadmodelAgreement,
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
        )
        .leftJoin(
          agreementSignedContractInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementSignedContractInReadmodelAgreement.agreementId
          )
        )
        .orderBy(
          ascLower(queryAgreementIds.eserviceName),
          agreementInReadmodelAgreement.id
        );

      const [resultSet, totalCount] = await Promise.all([
        outerQuery,
        filters.showOnlyUpgradeable
          ? Promise.resolve(0)
          : getTableTotalCount(readmodelDB, queryBaseAgreementIds),
      ]);

      const agreements = aggregateAgreementArray(
        toAgreementAggregatorArray(resultSet)
      ).map(({ data }) => data);

      if (filters.showOnlyUpgradeable) {
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
      return createListResult(agreements, totalCount);
    },

    async getAgreementById(
      agreementId: AgreementId
    ): Promise<WithMetadata<Agreement> | undefined> {
      return await agreementReadModelServiceSQL.getAgreementById(agreementId);
    },

    async getAllAgreements(
      filters: AgreementQueryFilters
    ): Promise<Array<WithMetadata<Agreement>>> {
      const queryAgreementIds = readmodelDB
        .select(
          withTotalCount({
            id: agreementInReadmodelAgreement.id,
            eserviceName: eserviceInReadmodelCatalog.name,
          })
        )
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
          getAgreementsFilters({
            filters,
          })
        )
        .groupBy(
          agreementInReadmodelAgreement.id,
          eserviceInReadmodelCatalog.name
        )
        .orderBy(
          ascLower(eserviceInReadmodelCatalog.name),
          agreementInReadmodelAgreement.id
        )
        .as("queryAgreementIds");

      const resultSet = await readmodelDB
        .select({
          eserviceName: queryAgreementIds.eserviceName,
          agreement: agreementInReadmodelAgreement,
          attribute: agreementAttributeInReadmodelAgreement,
          consumerDocument: agreementConsumerDocumentInReadmodelAgreement,
          contract: agreementContractInReadmodelAgreement,
          stamp: agreementStampInReadmodelAgreement,
          totalCount: queryAgreementIds.totalCount,
          signedContract: agreementSignedContractInReadmodelAgreement,
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
        )
        .leftJoin(
          agreementSignedContractInReadmodelAgreement,
          eq(
            agreementInReadmodelAgreement.id,
            agreementSignedContractInReadmodelAgreement.agreementId
          )
        )
        .orderBy(
          ascLower(queryAgreementIds.eserviceName),
          agreementInReadmodelAgreement.id
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
      return (await attributeReadModelServiceSQL.getAttributeById(attributeId))
        ?.data;
    },

    async getAgreementsConsumers(
      requesterId: TenantId,
      consumerName: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      const buildBaseQuery = () =>
        addDelegationJoins(
          readmodelDB
            .select({
              id: tenantInReadmodelTenant.id,
              name: tenantInReadmodelTenant.name,
            })
            .from(tenantInReadmodelTenant)
            .leftJoin(
              agreementInReadmodelAgreement,
              eq(
                tenantInReadmodelTenant.id,
                agreementInReadmodelAgreement.consumerId
              )
            )
            .where(
              and(
                getNameFilter(tenantInReadmodelTenant.name, consumerName),
                getVisibilityFilter(requesterId)
              )
            )
            .groupBy(tenantInReadmodelTenant.id)
            .orderBy(ascLower(tenantInReadmodelTenant.name))
            .$dynamic()
        );

      const [totalCount, resultSet] = await Promise.all([
        getTableTotalCount(readmodelDB, buildBaseQuery()),
        buildBaseQuery().limit(limit).offset(offset),
      ]);

      return createListResult(
        resultSet.map(({ id, name }) => ({ id: unsafeBrandId(id), name })),
        totalCount
      );
    },

    async getAgreementsProducers(
      requesterId: TenantId,
      producerName: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> {
      const buildBaseQuery = () =>
        addDelegationJoins(
          readmodelDB
            .select({
              id: tenantInReadmodelTenant.id,
              name: tenantInReadmodelTenant.name,
            })
            .from(tenantInReadmodelTenant)
            .leftJoin(
              agreementInReadmodelAgreement,
              eq(
                tenantInReadmodelTenant.id,
                agreementInReadmodelAgreement.producerId
              )
            )
            .where(
              and(
                getNameFilter(tenantInReadmodelTenant.name, producerName),
                getVisibilityFilter(requesterId)
              )
            )
            .groupBy(tenantInReadmodelTenant.id)
            .orderBy(ascLower(tenantInReadmodelTenant.name))
            .$dynamic()
        );

      const [totalCount, resultSet] = await Promise.all([
        getTableTotalCount(readmodelDB, buildBaseQuery()),
        buildBaseQuery().limit(limit).offset(offset),
      ]);

      return createListResult(
        resultSet.map(({ id, name }) => ({ id: unsafeBrandId(id), name })),
        totalCount
      );
    },

    async getAgreementsEServices(
      requesterId: TenantId,
      filters: AgreementEServicesQueryFilters,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactEService>> {
      const { consumerIds, producerIds, eserviceName } = filters;
      const withDelegationFilter = true;

      const buildBaseQuery = () =>
        addDelegationJoins(
          readmodelDB
            .select({
              id: eserviceInReadmodelCatalog.id,
              name: eserviceInReadmodelCatalog.name,
            })
            .from(eserviceInReadmodelCatalog)
            .leftJoin(
              agreementInReadmodelAgreement,
              eq(
                eserviceInReadmodelCatalog.id,
                agreementInReadmodelAgreement.eserviceId
              )
            )
            .where(
              and(
                getNameFilter(eserviceInReadmodelCatalog.name, eserviceName),
                getProducerIdsFilter(producerIds, withDelegationFilter),
                getConsumerIdsFilter(consumerIds, withDelegationFilter),
                getVisibilityFilter(requesterId)
              )
            )
            .groupBy(eserviceInReadmodelCatalog.id)
            .orderBy(ascLower(eserviceInReadmodelCatalog.name))
            .$dynamic()
        );

      const [totalCount, resultSet] = await Promise.all([
        getTableTotalCount(readmodelDB, buildBaseQuery()),
        buildBaseQuery().limit(limit).offset(offset),
      ]);

      return createListResult(
        resultSet.map(({ id, name }) => ({ id, name })),
        totalCount
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

    async getAgreementConsumerDocuments(
      agreementId: AgreementId,
      offset: number,
      limit: number
    ): Promise<ListResult<AgreementDocument>> {
      const buildBaseQuery = () =>
        readmodelDB
          .select({
            id: agreementConsumerDocumentInReadmodelAgreement.id,
            path: agreementConsumerDocumentInReadmodelAgreement.path,
            name: agreementConsumerDocumentInReadmodelAgreement.name,
            prettyName:
              agreementConsumerDocumentInReadmodelAgreement.prettyName,
            contentType:
              agreementConsumerDocumentInReadmodelAgreement.contentType,
            createdAt: agreementConsumerDocumentInReadmodelAgreement.createdAt,
          })
          .from(agreementConsumerDocumentInReadmodelAgreement)
          .where(
            eq(
              agreementConsumerDocumentInReadmodelAgreement.agreementId,
              agreementId
            )
          )
          .orderBy(asc(agreementConsumerDocumentInReadmodelAgreement.createdAt))
          .$dynamic();

      const [totalCount, resultsSet] = await Promise.all([
        getTableTotalCount(readmodelDB, buildBaseQuery()),
        buildBaseQuery().limit(limit).offset(offset),
      ]);

      return createListResult(
        resultsSet.map(
          (doc) =>
            ({
              id: unsafeBrandId<AgreementDocumentId>(doc.id),
              path: doc.path,
              name: doc.name,
              prettyName: doc.prettyName,
              contentType: doc.contentType,
              createdAt: stringToDate(doc.createdAt),
            }) satisfies AgreementDocument
        ),
        totalCount
      );
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
