import { Logger, RefreshableInteropToken } from "pagopa-interop-commons";
import { Agreement, DescriptorId, EServiceId } from "pagopa-interop-models";
import { CatalogProcessClient } from "./catalogProcessClient.js";
import { ReadModelService } from "./readModelService.js";
import { archiveDescriptorForArchivedAgreement } from "./archiveDescriptorProcessor.js";

export type EServiceDescriptorsArchiver = {
  archiveDescriptorsForArchivedAgreement: (
    archivedAgreement: Agreement,
    logger: Logger,
    correlationId: string
  ) => Promise<void>;
};

export const eserviceDescriptorArchiverBuilder = async (
  refreshableToken: RefreshableInteropToken,
  readModelService: ReadModelService,
  catalogProcessClient: CatalogProcessClient
): Promise<EServiceDescriptorsArchiver> => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const getHeaders = (correlationId: string, token: string) => ({
    "X-Correlation-Id": correlationId,
    Authorization: `Bearer ${token}`,
  });

  const archiveDescriptor = async (
    descriptorId: DescriptorId,
    eserviceId: EServiceId,
    correlationId: string
  ): Promise<void> => {
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
      archivedAgreement: Agreement,
      logger: Logger,
      correlationId: string
    ): Promise<void> => {
      const archivedDescriptor = await archiveDescriptorForArchivedAgreement(
        archivedAgreement,
        readModelService,
        archiveDescriptor,
        logger,
        correlationId
      );
      if (archivedDescriptor) {
        logger.info(
          `Sent Descriptor archive request for archived Agreement ${archivedAgreement.id} - Descriptor ${archivedAgreement.descriptorId} - EService ${archivedAgreement.eserviceId}`
        );
      }
    },
  };
};
