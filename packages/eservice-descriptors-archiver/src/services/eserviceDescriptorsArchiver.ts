import {
  RefreshableInteropToken,
  getContext,
  logger,
} from "pagopa-interop-commons";
import { Agreement, DescriptorId, EServiceId } from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { CatalogProcessClient } from "./catalogProcessClient.js";
import { ReadModelService } from "./readModelService.js";
import { archiveDescriptorForArchivedAgreement } from "./archiveDescriptorProcessor.js";

export type EServiceDescriptorsArchiver = {
  archiveDescriptorsForArchivedAgreement: (
    archivedAgreement: Agreement
  ) => Promise<void>;
};

export const eserviceDescriptorArchiverBuilder = async (
  refreshableToken: RefreshableInteropToken,
  readModelService: ReadModelService,
  catalogProcessClient: CatalogProcessClient
): Promise<EServiceDescriptorsArchiver> => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const getHeaders = (
    correlationId: string | undefined | null,
    token: string
  ) => ({
    "X-Correlation-Id": correlationId || uuidv4(),
    Authorization: `Bearer ${token}`,
  });

  const archiveDescriptor = async (
    descriptorId: DescriptorId,
    eserviceId: EServiceId
  ): Promise<void> => {
    const { correlationId } = getContext();
    const token = (await refreshableToken.get()).serialized;
    const headers = getHeaders(correlationId, token);

    await catalogProcessClient.archiveDescriptor(undefined, {
      params: {
        eServiceId: eserviceId,
        descriptorId,
      },
      headers,
    });
  };

  return {
    archiveDescriptorsForArchivedAgreement: async (
      archivedAgreement: Agreement
    ): Promise<void> => {
      const archivedDescriptor = await archiveDescriptorForArchivedAgreement(
        archivedAgreement,
        readModelService,
        archiveDescriptor
      );
      if (archivedDescriptor) {
        logger.info(
          `Sent Descriptor archive request for archived Agreement ${archivedAgreement.id} - Descriptor ${archivedAgreement.descriptorId} - EService ${archivedAgreement.eserviceId}`
        );
      }
    },
  };
};
