import { ReadModelRepository } from "pagopa-interop-commons";
import {
  ClientId,
  EService,
  PurposeId,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { z } from "zod";

export type ReadModelService = {
  getEServiceById: (id: string) => Promise<EService | undefined>;
  getClientsIdFromPurpose: (purposeId: PurposeId) => Promise<ClientId[]>;
};

export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
): ReadModelService {
  const eservices = readModelRepository.eservices;
  const clients = readModelRepository.clients;

  async function getEServiceById(id: string): Promise<EService | undefined> {
    const data = await eservices.findOne(
      { "data.id": id },
      { projection: { data: true } }
    );

    if (data) {
      const result = EService.safeParse(data.data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse eservices item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    }

    return undefined;
  }

  async function getClientsIdFromPurpose(
    purposeId: PurposeId
  ): Promise<ClientId[]> {
    const data = await clients
      .find(
        {
          $or: [
            {
              "data.purposes.purpose.purposeId": purposeId,
            },
            {
              "data.purposes": purposeId,
            },
          ],
        },
        { projection: { data: true } }
      )
      .map((c) => c.data)
      .toArray();

    const result = z.array(z.object({ id: z.string() })).safeParse(data);

    if (!result.success) {
      throw genericInternalError(
        `Unable to parse clients item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }

    return result.data.map((c) => unsafeBrandId<ClientId>(c.id));
  }

  return {
    getEServiceById,
    getClientsIdFromPurpose,
  };
}
