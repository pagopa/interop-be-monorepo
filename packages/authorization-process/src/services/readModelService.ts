import { ReadModelRepository } from "pagopa-interop-commons";
import {
  Client,
  WithMetadata,
  genericInternalError,
  ClientId,
} from "pagopa-interop-models";
import { z } from "zod";
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { clients } = readModelRepository;

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
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
