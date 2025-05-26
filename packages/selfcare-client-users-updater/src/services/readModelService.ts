import { ReadModelFilter, ReadModelRepository } from "pagopa-interop-commons";
import {
  Client,
  genericInternalError,
  UserId,
  TenantId,
  clientKind,
} from "pagopa-interop-models";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const clients = readModelRepository.clients;

  return {
    getClients: async ({
      consumerId,
      adminId,
    }: {
      consumerId: TenantId;
      adminId: UserId;
    }): Promise<Client[]> => {
      const consumerIdFilter: ReadModelFilter<Client> = {
        "data.consumerId": { $eq: consumerId },
      };

      const kindFilter: ReadModelFilter<Client> = {
        "data.kind": { $eq: clientKind.api },
      };

      const adminIdFilter: ReadModelFilter<Client> = adminId
        ? {
            "data.adminId": { $eq: adminId },
          }
        : {};

      const aggregationPipeline = [
        {
          $match: {
            ...consumerIdFilter,
            ...kindFilter,
            ...adminIdFilter,
          } satisfies ReadModelFilter<Client>,
        },
        {
          $project: {
            data: 1,
          },
        },
      ];

      const data = await clients
        .aggregate([...aggregationPipeline], {
          allowDiskUse: true,
        })
        .toArray();

      const result = z.array(Client).safeParse(data.map((d) => d.data));
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse client items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
