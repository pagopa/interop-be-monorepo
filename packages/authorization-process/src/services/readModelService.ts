import { Filter } from "mongodb";
import { WithId } from "mongodb";
import { ReadModelFilter, ReadModelRepository } from "pagopa-interop-commons";
import {
  Client,
  WithMetadata,
  genericInternalError,
  ClientId,
  UserId,
  PurposeId,
  TenantId,
  ListResult,
  EServiceId,
  EService,
  Purpose,
  Agreement,
} from "pagopa-interop-models";
import { z } from "zod";

export type GetClientsFilters = {
  name?: string;
  userIds: UserId[];
  consumerId: TenantId;
  purposeId: PurposeId | undefined;
  kind?: string;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { agreements, clients, eservices, purposes } = readModelRepository;

  async function getClient(
    filter: Filter<WithId<WithMetadata<Client>>>
  ): Promise<WithMetadata<Client> | undefined> {
    const data = await clients.findOne(filter, {
      projection: { data: true, metadata: true },
    });
    if (!data) {
      return undefined;
    } else {
      const result = z
        .object({
          data: Client,
          metadata: z.object({ version: z.number() }),
        })
        .safeParse(data);
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse client item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }
      return result.data;
    }
  }

  return {
    async getClientById(
      id: ClientId
    ): Promise<WithMetadata<Client> | undefined> {
      return getClient({ "data.id": id });
    },

    async getClients(
      filters: GetClientsFilters,
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ListResult<Client>> {
      const { name, userIds, consumerId, purposeId, kind } = filters;

      const nameFilter: ReadModelFilter<Client> = name
        ? {
            "data.name": {
              $regex: ReadModelRepository.escapeRegExp(name),
              $options: "i",
            },
          }
        : {};

      const userIdsFilter: ReadModelFilter<Client> =
        ReadModelRepository.arrayToFilter(userIds, {
          $or: userIds.map((userId) => ({ "data.users": { $eq: userId } })),
        });

      const consumerIdFilter: ReadModelFilter<Client> = {
        "data.consumerId": { $eq: consumerId },
      };

      const purposeIdFilter: ReadModelFilter<Client> = purposeId
        ? {
            "data.purposes": { $eq: purposeId },
          }
        : {};

      const kindFilter: ReadModelFilter<Client> = kind
        ? {
            "data.kind": { $eq: kind },
          }
        : {};

      const aggregationPipeline = [
        {
          $match: {
            ...nameFilter,
            ...userIdsFilter,
            ...consumerIdFilter,
            ...purposeIdFilter,
            ...kindFilter,
          } satisfies ReadModelFilter<Client>,
        },
        {
          $project: {
            data: 1,
            computedColumn: { $toLower: ["$data.name"] },
          },
        },
        {
          $sort: { computedColumn: 1 },
        },
      ];

      const data = await clients
        .aggregate(
          [...aggregationPipeline, { $skip: offset }, { $limit: limit }],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z.array(Client).safeParse(data.map((d) => d.data));
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse client items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          clients,
          aggregationPipeline,
          false
        ),
      };
    },
    async getClientsRelatedToPurpose(
      purposeId: PurposeId
    ): Promise<Array<WithMetadata<Client>>> {
      const data = await clients
        .aggregate(
          [
            {
              $match: {
                "data.purposes": { $eq: purposeId },
              },
            },
          ],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z
        .array(
          z.object({
            metadata: z.object({ version: z.number() }),
            data: Client,
          })
        )
        .safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse client items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    },
    async getEServiceById(
      eserviceId: EServiceId
    ): Promise<EService | undefined> {
      const data = await eservices.findOne(
        { "data.id": eserviceId },
        {
          projection: { data: true },
        }
      );
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
    },
    async getPurposeById(purposeId: PurposeId): Promise<Purpose | undefined> {
      const data = await purposes.findOne(
        { "data.id": purposeId },
        {
          projection: { data: true },
        }
      );
      if (!data) {
        return undefined;
      } else {
        const result = Purpose.safeParse(data.data);
        if (!result.success) {
          throw genericInternalError(
            `Unable to parse purpose item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }
        return result.data;
      }
    },
    async getAgreements(
      eserviceId: EServiceId,
      consumerId: TenantId
    ): Promise<Agreement[]> {
      const data = await agreements
        .find({
          "data.eserviceId": eserviceId,
          "data.consumerId": consumerId,
        })
        .toArray();

      const result = z.array(Agreement).safeParse(data.map((d) => d.data));
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse client item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }
      return result.data;
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
