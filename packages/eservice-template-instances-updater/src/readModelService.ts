import { ReadModelRepository } from "pagopa-interop-commons";
import { EService, genericInternalError } from "pagopa-interop-models";
import { z } from "zod";

export type ReadModelService = {
  getEServiceTemplateInstances: (id: string) => Promise<EService[]>;
};

export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
): ReadModelService {
  const eservices = readModelRepository.eservices;

  async function getEServiceTemplateInstances(
    eserviceTemplateId: string
  ): Promise<EService[]> {
    const data = await eservices
      .find(
        { "data.templateId": eserviceTemplateId },
        { projection: { data: true } }
      )
      .map((item) => item.data)
      .toArray();

    const result = z.array(EService).safeParse(data);

    if (!result.success) {
      throw genericInternalError(
        `Unable to parse eservices items: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }

    return result.data;
  }

  return {
    getEServiceTemplateInstances,
  };
}
