import { Filter, WithId } from "mongodb";
import {
  EServiceCollection,
  ReadModelFilter,
  ReadModelRepository,
} from "pagopa-interop-commons";
import {
  agreementState,
  Delegation,
  DelegationId,
  delegationKind,
  DelegationKind,
  delegationState,
  DelegationState,
  EService,
  EServiceId,
  EServiceReadModel,
  genericInternalError,
  ListResult,
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
  const { delegations, eservices, tenants } = readModelRepository;

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
    }): Promise<ListResult<Delegation>> {
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

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          delegations,
          aggregationPipeline
        ),
      };
    },
    async getConsumerDelegators(filters: {
      delegateId: TenantId;
      limit: number;
      offset: number;
      delegatorName?: string;
    }): Promise<delegationApi.CompactTenants> {
      const aggregationPipeline = [
        {
          $match: {
            "data.kind": delegationKind.delegatedConsumer,
            "data.state": delegationState.active,
            "data.delegateId": filters.delegateId,
          } satisfies ReadModelFilter<Delegation>,
        },
        {
          $lookup: {
            from: "eservices",
            localField: "data.eserviceId",
            foreignField: "data.id",
            as: "eservice",
          },
        },
        {
          $unwind: "$eservice",
        },
        {
          $lookup: {
            from: "agreements",
            let: {
              producerId: "$eservice.data.producerId",
              consumerId: "$data.delegatorId",
              eserviceId: "$eservice.data.id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$data.producerId", "$$producerId"] },
                      { $eq: ["$data.consumerId", "$$consumerId"] },
                      { $eq: ["$data.eserviceId", "$$eserviceId"] },
                      { $eq: ["$data.state", agreementState.active] },
                    ],
                  },
                },
              },
            ],
            as: "activeAgreements",
          },
        },
        {
          $match: {
            activeAgreements: { $ne: [] }, // Keep only delegations with active agreements
          },
        },
        {
          $lookup: {
            from: "tenants",
            localField: "data.delegatorId",
            foreignField: "data.id",
            as: "delegator",
          },
        },
        {
          $unwind: "$delegator",
        },
        ...(filters.delegatorName
          ? [
              {
                $match: {
                  "delegator.data.name": {
                    $regex: ReadModelRepository.escapeRegExp(
                      filters.delegatorName
                    ),
                    $options: "i",
                  },
                },
              },
            ]
          : []),
        {
          $group: {
            _id: "$delegator.data.id",
            name: { $first: "$delegator.data.name" },
          },
        },
        {
          $project: {
            _id: 0,
            id: "$_id",
            name: 1,
          },
        },
        {
          $sort: { name: 1 },
        },
      ];

      const data = await delegations
        .aggregate(
          [
            ...aggregationPipeline,
            { $skip: filters.offset },
            { $limit: filters.limit },
          ],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z.array(delegationApi.CompactTenant).safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse compact delegation tenants: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)}`
        );
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          delegations,
          aggregationPipeline
        ),
      };
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
