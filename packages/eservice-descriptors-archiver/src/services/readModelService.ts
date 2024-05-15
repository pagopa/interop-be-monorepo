import { ReadModelRepository } from "pagopa-interop-commons";
import {
  Agreement,
  DescriptorId,
  EService,
  EServiceId,
  agreementState,
  genericInternalError,
} from "pagopa-interop-models";
import { z } from "zod";

export type ReadModelService = {
  getNonArchivedAgreementsByEserviceAndDescriptorId: (
    eserviceId: EServiceId,
    descriptorId: DescriptorId
  ) => Promise<Agreement[]>;

  getEServiceById: (id: string) => Promise<EService | undefined>;
};

export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
): ReadModelService {
  const agreements = readModelRepository.agreements;
  const eservices = readModelRepository.eservices;

  async function getNonArchivedAgreementsByEserviceAndDescriptorId(
    eserviceId: EServiceId,
    descriptorId: DescriptorId
  ): Promise<Agreement[]> {
    const data = await agreements
      .find({
        "data.eserviceId": eserviceId,
        "data.descriptorId": descriptorId,
        "data.state": { $ne: agreementState.archived },
      })
      .toArray();

    const result = z.array(Agreement).safeParse(data.map((a) => a.data));

    if (!result.success) {
      throw genericInternalError(
        `Unable to parse agreements: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }

    return result.data;
  }

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
    getNonArchivedAgreementsByEserviceAndDescriptorId,
    getEServiceById,
  };
}
