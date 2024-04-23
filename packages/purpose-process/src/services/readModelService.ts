import {
  logger,
  ReadModelRepository,
  EServiceCollection,
  TenantCollection,
  PurposeCollection,
  ReadModelFilter,
} from "pagopa-interop-commons";
import {
  EService,
  genericError,
  WithMetadata,
  EServiceId,
  TenantId,
  Tenant,
  EServiceReadModel,
  Purpose,
  PurposeId,
  ListResult,
  purposeVersionState,
} from "pagopa-interop-models";
import { Filter, WithId } from "mongodb";
import { z } from "zod";
import { ApiGetPurposesFilters } from "../model/domain/models.js";

async function getPurpose(
  purposes: PurposeCollection,
  filter: Filter<WithId<WithMetadata<Purpose>>>
): Promise<WithMetadata<Purpose> | undefined> {
  const data = await purposes.findOne(filter, {
    projection: { data: true, metadata: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = z
      .object({
        data: Purpose,
        metadata: z.object({ version: z.number() }),
      })
      .safeParse(data);
    if (!result.success) {
      logger.error(
        `Unable to parse purpose item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
      throw genericError("Unable to parse purpose item");
    }
    return result.data;
  }
}

async function getEService(
  eservices: EServiceCollection,
  filter: Filter<WithId<WithMetadata<EServiceReadModel>>>
): Promise<EService | undefined> {
  const data = await eservices.findOne(filter, {
    projection: { data: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = EService.safeParse(data.data);
    if (!result.success) {
      logger.error(
        `Unable to parse eService item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
      throw genericError("Unable to parse eService item");
    }
    return result.data;
  }
}

async function getTenant(
  tenants: TenantCollection,
  filter: Filter<WithId<WithMetadata<Tenant>>>
): Promise<Tenant | undefined> {
  const data = await tenants.findOne(filter, {
    projection: { data: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = Tenant.safeParse(data.data);
    if (!result.success) {
      logger.error(
        `Unable to parse tenant item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
      throw genericError("Unable to parse tenant item");
    }
    return result.data;
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { eservices, purposes, tenants } = readModelRepository;

  return {
    async getEServiceById(id: EServiceId): Promise<EService | undefined> {
      return getEService(eservices, { "data.id": id });
    },
    async getTenantById(id: TenantId): Promise<Tenant | undefined> {
      return getTenant(tenants, { "data.id": id });
    },
    async getPurposeById(
      id: PurposeId
    ): Promise<WithMetadata<Purpose> | undefined> {
      return getPurpose(purposes, { "data.id": id });
    },
    async getPurposes(
      filters: ApiGetPurposesFilters,
      offset: number,
      limit: number
    ): Promise<ListResult<Purpose>> {
      const {
        name,
        eservicesIds,
        consumersIds,
        producersIds,
        states,
        excludeDraft,
      } = filters;

      const nameFilter: ReadModelFilter<Purpose> = name
        ? {
            "data.title": {
              $regex: ReadModelRepository.escapeRegExp(name),
              $options: "i",
            },
          }
        : {};

      const eservicesIdsFilter: ReadModelFilter<Purpose> =
        ReadModelRepository.arrayToFilter(eservicesIds, {
          "data.eserviceId": { $in: eservicesIds },
        });

      const consumersIdsFilter: ReadModelFilter<Purpose> =
        ReadModelRepository.arrayToFilter(consumersIds, {
          "data.consumerId": { $in: consumersIds },
        });

      const versionStateFilter: ReadModelFilter<Purpose> =
        ReadModelRepository.arrayToFilter(states, {
          "data.versions.state": { $in: states },
        });

      const draftFilter: ReadModelFilter<Purpose> = excludeDraft
        ? {
            $nor: [
              { "data.versions": { $size: 0 } },
              {
                $and: [
                  { "data.versions": { $size: 1 } },
                  {
                    "data.versions.state": {
                      $eq: purposeVersionState.draft,
                    },
                  },
                ],
              },
            ],
          }
        : {};

      const aggregationPipeline = [
        {
          $match: {
            ...nameFilter,
            ...eservicesIdsFilter,
            ...consumersIdsFilter,
            ...versionStateFilter,
            ...draftFilter,
          } satisfies ReadModelFilter<Purpose>,
        },
        ...(producersIds.length > 0
          ? [
              {
                $lookup: {
                  from: "eservices",
                  localField: "data.eserviceId",
                  foreignField: "data.id",
                  as: "eservices",
                },
              },
              { $unwind: "$eservices" },
              {
                $match: {
                  "eservices.data.producerId": { $in: producersIds },
                },
              },
            ]
          : []),
        {
          $project: {
            data: 1,
            computedColumn: { $toLower: ["$data.title"] },
          },
        },
        {
          $sort: { computedColumn: 1 },
        },
      ];

      const data = await purposes
        .aggregate(
          [...aggregationPipeline, { $skip: offset }, { $limit: limit }],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z.array(Purpose).safeParse(data.map((d) => d.data));
      if (!result.success) {
        logger.error(
          `Unable to parse purposes items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw genericError("Unable to parse purposes items");
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          purposes,
          aggregationPipeline
        ),
      };
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
