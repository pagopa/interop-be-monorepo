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
  agreementState,
  ClientKey,
  ClientKind,
} from "pagopa-interop-models";
import { z } from "zod";

export type GetClientsFilters = {
  name?: string;
  userIds: UserId[];
  consumerId: TenantId;
  purposeId: PurposeId | undefined;
  kind?: ClientKind;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { agreements, clients, eservices, purposes } = readModelRepository;

  return {
    async getClientById(
      id: ClientId
    ): Promise<WithMetadata<Client> | undefined> {
      const data = await clients.findOne(
        { "data.id": id },
        {
          projection: { data: true, metadata: true },
        }
      );
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
      ];

      const data = await clients
        .aggregate(
          [
            ...aggregationPipeline,
            { $skip: offset },
            { $limit: limit },
            { $sort: { computedColumn: 1 } },
          ],
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
        .find({
          "data.purposes": { $eq: purposeId },
        })
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
    async getActiveOrSuspendedAgreement(
      eserviceId: EServiceId,
      consumerId: TenantId
    ): Promise<Agreement | undefined> {
      const data = await agreements.findOne({
        "data.eserviceId": eserviceId,
        "data.consumerId": consumerId,
        "data.state": {
          $in: [agreementState.active, agreementState.suspended],
        },
      });

      if (data) {
        const result = Agreement.safeParse(data?.data);
        if (!result.success) {
          throw genericInternalError(
            `Unable to parse agreement item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }
        return result.data;
      }
      return undefined;
    },
    async getKeyByKid(kid: string): Promise<ClientKey | undefined> {
      const data = await clients.findOne(
        { "data.keys.kid": { $eq: kid } },
        {
          projection: { data: true },
        }
      );
      if (data) {
        const result = Client.safeParse(data.data);
        if (!result.success) {
          throw genericInternalError(
            `Unable to parse client item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }
        return result.data.keys.find((k) => k.kid === kid);
      }
      return undefined;
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
