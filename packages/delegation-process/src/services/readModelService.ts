import { Filter, WithId } from "mongodb";
import {
  EServiceCollection,
  ReadModelFilter,
  ReadModelRepository,
} from "pagopa-interop-commons";
import {
  Agreement,
  agreementState,
  Delegation,
  DelegationId,
  delegationKind,
  DelegationKind,
  DelegationState,
  EService,
  EServiceId,
  EServiceReadModel,
  genericInternalError,
  Tenant,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
import { z } from "zod";
import { delegationApi } from "pagopa-interop-api-clients";
import { GetDelegationsFilters } from "../model/domain/models.js";

const toReadModelFilter = (
  filters: GetDelegationsFilters
): ReadModelFilter<Delegation> => {
  const { delegateId, delegatorId, eserviceId, delegationKind, states } =
    filters;

  const delegatorIdFilter = delegatorId
    ? {
        "data.delegatorId": { $eq: delegatorId },
      }
    : {};
  const delegateIdFilter = delegateId
    ? {
        "data.delegateId": { $eq: delegateId },
      }
    : {};
  const eserviceIdFilter = eserviceId
    ? {
        "data.eserviceId": { $eq: eserviceId },
      }
    : {};
  const delegationKindFilter = delegationKind
    ? {
        "data.kind": { $eq: delegationKind },
      }
    : {};
  const stateFilter =
    states && states.length > 0
      ? {
          "data.state": { $in: states },
        }
      : {};

  return {
    ...delegatorIdFilter,
    ...delegateIdFilter,
    ...eserviceIdFilter,
    ...delegationKindFilter,
    ...stateFilter,
  };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { delegations, eservices, tenants, agreements } = readModelRepository;

  return {
    async getEService(
      eservices: EServiceCollection,
      filter: Filter<WithId<WithMetadata<EServiceReadModel>>>
    ): Promise<WithMetadata<EService> | undefined> {
      const data = await eservices.findOne(filter, {
        projection: { data: true, metadata: true },
      });
      if (!data) {
        return undefined;
      } else {
        const result = z
          .object({
            metadata: z.object({ version: z.number() }),
            data: EService,
          })
          .safeParse(data);
        if (!result.success) {
          throw genericInternalError(
            `Unable to parse eService item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }
        return {
          data: result.data.data,
          metadata: { version: result.data.metadata.version },
        };
      }
    },
    async getDelegation(
      id: DelegationId,
      kind: DelegationKind | undefined = undefined
    ): Promise<WithMetadata<Delegation> | undefined> {
      const data = await delegations.findOne(
        { "data.id": id, ...(kind ? { "data.kind": kind } : {}) },
        {
          projection: { data: true, metadata: true },
        }
      );
      if (!data) {
        return undefined;
      }

      const result = Delegation.safeParse(data.data);
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse delegation item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }
      return data;
    },
    async findDelegations(
      filters: GetDelegationsFilters
    ): Promise<Delegation[]> {
      const results = await delegations
        .aggregate([{ $match: toReadModelFilter(filters) }], {
          allowDiskUse: true,
        })
        .toArray();

      if (!results) {
        return [];
      }

      return results.map((res) => {
        const result = Delegation.safeParse(res.data);
        if (!result.success) {
          throw genericInternalError(
            `Unable to parse delegation item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(res)} `
          );
        }
        return result.data;
      });
    },
    async getEServiceById(
      id: EServiceId
    ): Promise<WithMetadata<EService> | undefined> {
      return this.getEService(eservices, { "data.id": id });
    },
    async createDelegation(delegation: Delegation): Promise<void> {
      await delegations.insertOne({
        data: delegation,
        metadata: { version: 0 },
      });
    },
    async getTenantById(tenantId: string): Promise<Tenant | undefined> {
      const data = await tenants.findOne(
        { "data.id": tenantId },
        { projection: { data: true } }
      );

      if (data) {
        const result = Tenant.safeParse(data.data);

        if (!result.success) {
          throw genericInternalError(
            `Unable to parse tenant item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }

        return result.data;
      }
      return undefined;
    },
    async getDelegations({
      delegateIds,
      delegatorIds,
      eserviceIds,
      delegationStates,
      kind,
      offset,
      limit,
    }: {
      delegateIds: TenantId[];
      delegatorIds: TenantId[];
      eserviceIds: EServiceId[];
      delegationStates: DelegationState[];
      kind: DelegationKind | undefined;
      offset: number;
      limit: number;
    }): Promise<Delegation[]> {
      const aggregationPipeline = [
        {
          $match: {
            ...ReadModelRepository.arrayToFilter(delegateIds, {
              "data.delegateId": { $in: delegateIds },
            }),
            ...ReadModelRepository.arrayToFilter(delegatorIds, {
              "data.delegatorId": { $in: delegatorIds },
            }),
            ...ReadModelRepository.arrayToFilter(eserviceIds, {
              "data.eserviceId": { $in: eserviceIds },
            }),
            ...ReadModelRepository.arrayToFilter(delegationStates, {
              "data.state": { $in: delegationStates },
            }),
            ...(kind && {
              "data.kind": kind,
            }),
          } satisfies ReadModelFilter<Delegation>,
        },
        {
          $project: {
            data: 1,
          },
        },
      ];

      const aggregationWithOffsetLimit = [
        ...aggregationPipeline,
        { $skip: offset },
        { $limit: limit },
      ];

      const data = await delegations
        .aggregate(aggregationWithOffsetLimit, { allowDiskUse: true })
        .toArray();
      const result = z.array(Delegation).safeParse(data.map((a) => a.data));

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse delegations: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    },
    async getDelegationTenants(filters: {
      delegatedIds: TenantId[];
      delegatorIds: TenantId[];
      eserviceIds: EServiceId[];
      delegateName: string | undefined;
      delegatorName: string | undefined;
      states: DelegationState[];
      kind: DelegationKind;
    }): Promise<delegationApi.CompactDelegationTenants[]> {
      const getEservicesWithActiveAgreements = async (
        delegations: delegationApi.CompactDelegationTenants[]
      ): Promise<string[]> => {
        const conditions =
          filters.kind === delegationKind.delegatedConsumer
            ? delegations.map((d) => ({
                "data.eserviceId": d.eserviceId,
                "data.consumerId": d.delegator.id,
              }))
            : delegations.map((d) => ({
                "data.eserviceId": d.eserviceId,
                "data.producerId": d.delegator.id,
              }));

        const data = await agreements.distinct("data.eserviceId", {
          $or: conditions,
          "data.state": agreementState.active,
        } satisfies ReadModelFilter<Agreement>);

        const result = z.array(z.string()).safeParse(data);

        if (!result.success) {
          throw genericInternalError(
            `Unable to parse agreements: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)}`
          );
        }

        return result.data;
      };

      const nameFilters = [
        filters.delegateName
          ? [
              {
                $match: {
                  "delegate.name": {
                    $regex: ReadModelRepository.escapeRegExp(
                      filters.delegateName
                    ),
                    $options: "i",
                  },
                },
              },
            ]
          : [],
        filters.delegatorName
          ? [
              {
                $match: {
                  "delegator.name": {
                    $regex: ReadModelRepository.escapeRegExp(
                      filters.delegatorName
                    ),
                    $options: "i",
                  },
                },
              },
            ]
          : [],
      ];

      const aggregationPipeline = [
        {
          $match: {
            ...ReadModelRepository.arrayToFilter(filters.delegatedIds, {
              "data.delegateId": { $in: filters.delegatedIds },
            }),
            ...ReadModelRepository.arrayToFilter(filters.delegatorIds, {
              "data.delegatorId": { $in: filters.delegatorIds },
            }),
            ...ReadModelRepository.arrayToFilter(filters.eserviceIds, {
              "data.eserviceId": { $in: filters.eserviceIds },
            }),
            ...ReadModelRepository.arrayToFilter(filters.states, {
              "data.state": { $in: filters.states },
            }),
            ...(filters.kind && {
              "data.kind": filters.kind,
            }),
          } satisfies ReadModelFilter<Delegation>,
        },
        {
          $lookup: {
            from: "tenants",
            localField: "delegateId",
            foreignField: "id",
            as: "delegate",
          },
        },
        {
          $lookup: {
            from: "tenants",
            localField: "delegatorId",
            foreignField: "id",
            as: "delegator",
          },
        },
        {
          $unwind: "$delegate",
        },
        {
          $unwind: "$delegator",
        },
        ...nameFilters,
        {
          $project: {
            delegationId: "$id",
            eserviceId: "$eserviceId",
            state: "$state",
            kind: "$kind",
            delegate: {
              id: "$delegate.id",
              name: "$delegate.name",
            },
            delegator: {
              id: "$delegator.id",
              name: "$delegator.name",
            },
          },
        },
      ];

      const data = await delegations
        .aggregate(aggregationPipeline, { allowDiskUse: true })
        .toArray();

      const result = z
        .array(delegationApi.CompactDelegationTenants)
        .safeParse(data.map((d) => d.data));

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse compact delegation tenants: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)}`
        );
      }

      const eservicesWithActiveAgreements =
        await getEservicesWithActiveAgreements(result.data);

      return result.data.filter((delegation) =>
        eservicesWithActiveAgreements.includes(delegation.eserviceId)
      );
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
