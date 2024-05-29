import { ReadModelRepository } from "pagopa-interop-commons";
import {
  Client,
  EService,
  PurposeId,
  genericInternalError,
} from "pagopa-interop-models";
import { z } from "zod";

export type ReadModelService = {
  getEServiceById: (id: string) => Promise<EService | undefined>;
  getClientsPurpose: (purposeId: PurposeId) => Promise<Client[]>;
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

  async function getClientsPurpose(purposeId: PurposeId): Promise<Client[]> {
    const data = await clients
      .find(
        {
          "data.purposes.purpose.purposeId": purposeId,
        },
        { projection: { data: true } }
      )
      .map((c) => c.data)
      .toArray();

    const result = z.array(Client).safeParse(data);

    if (!result.success) {
      throw genericInternalError(
        `Unable to parse clients item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }

    return result.data;
  }

  return {
    getEServiceById,
    getClientsPurpose,
  };
}
