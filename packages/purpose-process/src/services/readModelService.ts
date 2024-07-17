import {
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
  genericInternalError,
  PurposeReadModel,
  ListResult,
  purposeVersionState,
  Agreement,
  agreementState,
  PurposeVersionState,
} from "pagopa-interop-models";
import { Document, Filter, WithId } from "mongodb";
import { z } from "zod";

export type GetPurposesFilters = {
  title?: string;
  eservicesIds: EServiceId[];
  consumersIds: TenantId[];
  producersIds: TenantId[];
  states: PurposeVersionState[];
  excludeDraft: boolean | undefined;
};

async function getPurpose(
  purposes: PurposeCollection,
  filter: Filter<WithId<WithMetadata<PurposeReadModel>>>
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
      throw genericInternalError(
        `Unable to parse purpose item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
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
      throw genericInternalError(
        `Unable to parse eService item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
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
      throw genericInternalError(
        `Unable to parse tenant item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return result.data;
  }
}

async function buildGetPurposesAggregation(
  filters: GetPurposesFilters,
  eservices: EServiceCollection
): Promise<Document[]> {
  const {
    title,
    eservicesIds,
    consumersIds,
    producersIds,
    states,
    excludeDraft,
  } = filters;

  const titleFilter: ReadModelFilter<Purpose> = title
    ? {
        "data.title": {
          $regex: ReadModelRepository.escapeRegExp(title),
          $options: "i",
        },
      }
    : {};

  const consumersIdsFilter: ReadModelFilter<Purpose> =
    ReadModelRepository.arrayToFilter(consumersIds, {
      "data.consumerId": { $in: consumersIds },
    });

  const notArchivedStates = Object.values(PurposeVersionState.Values).filter(
    (state) => state !== purposeVersionState.archived
  );

  const versionStateFilter: ReadModelFilter<Purpose> =
    ReadModelRepository.arrayToFilter(states, {
      $or: states.map((state) =>
        state === purposeVersionState.archived
          ? {
              $and: [
                { "data.versions.state": { $eq: state } },
                ...notArchivedStates.map((otherState) => ({
                  "data.versions.state": { $ne: otherState },
                })),
              ],
            }
          : { "data.versions.state": { $eq: state } }
      ),
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

  const producerEServiceIds =
    producersIds.length > 0
      ? await eservices
          .find({ "data.producerId": { $in: producersIds } })
          .toArray()
          .then((results) =>
            results.map((eservice) => eservice.data.id.toString())
          )
      : [];

  const eservicesIdsFilter: ReadModelFilter<Purpose> =
    /**
     * In case both producersIds and eservicesIds filters are present,
     * we need to filter by the intersection of the two
     */
    producersIds.length > 0 && eservicesIds.length > 0
      ? {
          "data.eserviceId": {
            $in: eservicesIds.filter((eserviceId) =>
              producerEServiceIds.includes(eserviceId)
            ),
          },
        }
      : ReadModelRepository.arrayToFilter(
          [...eservicesIds, ...producerEServiceIds],
          {
            "data.eserviceId": {
              $in: [...eservicesIds, ...producerEServiceIds],
            },
          }
        );

  return [
    {
      $match: {
        ...titleFilter,
        ...eservicesIdsFilter,
        ...consumersIdsFilter,
        ...versionStateFilter,
        ...draftFilter,
      } satisfies ReadModelFilter<Purpose>,
    },
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
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { eservices, purposes, tenants, agreements } = readModelRepository;

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
    async getPurpose(
      eserviceId: EServiceId,
      consumerId: TenantId,
      title: string
    ): Promise<WithMetadata<Purpose> | undefined> {
      return getPurpose(purposes, {
        "data.eserviceId": eserviceId,
        "data.consumerId": consumerId,
        "data.title": {
          $regex: `^${ReadModelRepository.escapeRegExp(title)}$$`,
          $options: "i",
        },
      } satisfies ReadModelFilter<Purpose>);
    },
    async getPurposes(
      filters: GetPurposesFilters,
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ListResult<Purpose>> {
      const aggregationPipeline = await buildGetPurposesAggregation(
        filters,
        eservices
      );
      const data = await purposes
        .aggregate(
          [...aggregationPipeline, { $skip: offset }, { $limit: limit }],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z.array(Purpose).safeParse(data.map((d) => d.data));
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse purposes items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          purposes,
          aggregationPipeline,
          false
        ),
      };
    },
    async getActiveAgreement(
      eserviceId: EServiceId,
      consumerId: TenantId
    ): Promise<Agreement | undefined> {
      const data = await agreements.findOne({
        "data.eserviceId": eserviceId,
        "data.consumerId": consumerId,
        "data.state": agreementState.active,
      });
      if (!data) {
        return undefined;
      } else {
        const result = Agreement.safeParse(data.data);
        if (!result.success) {
          throw genericError("Unable to parse agreement item");
        }
        return result.data;
      }
    },
    async getAllPurposes(filters: GetPurposesFilters): Promise<Purpose[]> {
      const aggregationPipeline = await buildGetPurposesAggregation(
        filters,
        eservices
      );

      const data = await purposes
        .aggregate(aggregationPipeline, { allowDiskUse: true })
        .toArray();

      const result = z.array(Purpose).safeParse(data.map((d) => d.data));
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse purposes items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
