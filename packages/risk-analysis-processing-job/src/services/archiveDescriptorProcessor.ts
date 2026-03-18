import { Logger, RefreshableInteropToken } from "pagopa-interop-commons";
import {
  Agreement,
  CorrelationId,
  descriptorState,
  genericInternalError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { CatalogProcessZodiosClient } from "./catalogProcessClient.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

// eslint-disable-next-line max-params
export async function archiveDescriptorForArchivedAgreement(
  archivedAgreement: Agreement,
  refreshableToken: RefreshableInteropToken,
  readModelService: ReadModelServiceSQL,
  catalogProcessClient: CatalogProcessZodiosClient,
  logger: Logger,
  correlationId: CorrelationId
): Promise<void> {
  const relatingNonArchivedAgreements = (
    await readModelService.getNonArchivedAgreementsByEserviceAndDescriptorId(
      archivedAgreement.eserviceId,
      archivedAgreement.descriptorId
    )
  ).filter((a) => a.id !== archivedAgreement.id);

  const allArchived = relatingNonArchivedAgreements.length === 0;

  if (!allArchived) {
    logger.info(
      `Skipping descriptors archiving - not all agreements are archived for Descriptor ${archivedAgreement.descriptorId} of EService ${archivedAgreement.eserviceId}`
    );
    return undefined;
  }

  const eservice = await readModelService.getEServiceById(
    archivedAgreement.eserviceId
  );

  if (!eservice) {
    throw genericInternalError(
      `EService not found for agreement ${archivedAgreement.id}`
    );
  }

  const descriptor = eservice.descriptors.find(
    (d) => d.id === archivedAgreement.descriptorId
  );

  if (!descriptor) {
    throw genericInternalError(
      `Descriptor not found for agreement ${archivedAgreement.id}`
    );
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const getHeaders = (correlationId: CorrelationId, token: string) => ({
    "X-Correlation-Id": correlationId,
    Authorization: `Bearer ${token}`,
  });

  return await match(descriptor)
    .with({ state: descriptorState.deprecated }, async () => {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);
      await catalogProcessClient.archiveDescriptor(undefined, {
        params: {
          eServiceId: archivedAgreement.eserviceId,
          descriptorId: archivedAgreement.descriptorId,
        },
        headers,
      });

      logger.info(
        `Descriptor archived for archived Agreement ${archivedAgreement.id} - Descriptor ${archivedAgreement.descriptorId} - EService ${archivedAgreement.eserviceId}`
      );
    })
    .with({ state: descriptorState.suspended }, async () => {
      const newerDescriptorExists = eservice.descriptors.some(
        (d) =>
          (d.state === descriptorState.published ||
            d.state === descriptorState.suspended) &&
          Number(d.version) > Number(descriptor.version)
      );
      if (newerDescriptorExists) {
        const token = (await refreshableToken.get()).serialized;
        const headers = getHeaders(correlationId, token);
        await catalogProcessClient.archiveDescriptor(undefined, {
          params: {
            eServiceId: archivedAgreement.eserviceId,
            descriptorId: archivedAgreement.descriptorId,
          },
          headers,
        });
        logger.info(
          `Descriptor archived for archived Agreement ${archivedAgreement.id} - Descriptor ${archivedAgreement.descriptorId} - EService ${archivedAgreement.eserviceId}`
        );
      } else {
        logger.info(
          `Skipping descriptor archiving for Descriptor ${archivedAgreement.descriptorId} of EService ${archivedAgreement.eserviceId} - Descriptor suspended but no newer Descriptor found`
        );
      }
    })
    .otherwise(() => {
      logger.info(
        `Skipping descriptor archiving for Descriptor ${archivedAgreement.descriptorId} of EService ${archivedAgreement.eserviceId} - Descriptor state is not Deprecated or Suspended (state: ${descriptor.state})`
      );
    });
}
