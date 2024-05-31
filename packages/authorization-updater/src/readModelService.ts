import { ReadModelRepository } from "pagopa-interop-commons";
import { EService, genericInternalError } from "pagopa-interop-models";

export type ReadModelService = {
  getEServiceById: (id: string) => Promise<EService | undefined>;
};

export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
): ReadModelService {
  const eservices = readModelRepository.eservices;

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

  return {
    getEServiceById,
  };
}
