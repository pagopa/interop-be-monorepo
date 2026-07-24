import {
  Logger,
  RefreshableInteropToken,
  CORRELATION_ID_HEADER,
} from "pagopa-interop-commons";
import {
  Agreement,
  CorrelationId,
  Descriptor,
  descriptorState,
  genericInternalError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

import { CatalogProcessZodiosClient } from "./catalogProcessClient.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

const isNewerActiveDescriptor = (
  descriptor: Descriptor,
  targetVersion: number
): boolean =>
  match(descriptor.state)
    .with(
      descriptorState.published,
      descriptorState.suspended,
      descriptorState.archiving,
      descriptorState.archivingSuspended,
      () => Number(descriptor.version) > targetVersion
    )
    .with(
      descriptorState.draft,
      descriptorState.deprecated,
      descriptorState.waitingForApproval,
      descriptorState.archived,
      () => false
    )
    .exhaustive();

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
    [CORRELATION_ID_HEADER]: correlationId,
    Authorization: `Bearer ${token}`,
  });

  return await match(descriptor.state)
    .with(descriptorState.deprecated, async () => {
      const token = (await refreshableToken.get()).serialized;
      const headers = getHeaders(correlationId, token);
      await catalogProcessClient.archiveDescriptor(
        { kind: "AUTOMATIC" },
        {
          params: {
            eServiceId: archivedAgreement.eserviceId,
            descriptorId: archivedAgreement.descriptorId,
          },
          headers,
        }
      );

      logger.info(
        `Descriptor archived for archived Agreement ${archivedAgreement.id} - Descriptor ${archivedAgreement.descriptorId} - EService ${archivedAgreement.eserviceId}`
      );
    })
    .with(
      descriptorState.suspended,
      descriptorState.archiving,
      descriptorState.archivingSuspended,
      async () => {
        const newerDescriptorExists = eservice.descriptors.some((d) =>
          isNewerActiveDescriptor(d, Number(descriptor.version))
        );
        if (newerDescriptorExists) {
          const token = (await refreshableToken.get()).serialized;
          const headers = getHeaders(correlationId, token);
          await catalogProcessClient.archiveDescriptor(
            { kind: "AUTOMATIC" },
            {
              params: {
                eServiceId: archivedAgreement.eserviceId,
                descriptorId: archivedAgreement.descriptorId,
              },
              headers,
            }
          );
          logger.info(
            `Descriptor archived for archived Agreement ${archivedAgreement.id} - Descriptor ${archivedAgreement.descriptorId} - EService ${archivedAgreement.eserviceId}`
          );
        } else {
          logger.info(
            `Skipping descriptor archiving for Descriptor ${archivedAgreement.descriptorId} of EService ${archivedAgreement.eserviceId} - Descriptor ${descriptor.state} but no newer Descriptor found`
          );
        }
      }
    )
    .with(
      descriptorState.published,
      descriptorState.draft,
      descriptorState.waitingForApproval,
      descriptorState.archived,
      () => {
        logger.info(
          `Skipping descriptor archiving for Descriptor ${archivedAgreement.descriptorId} of EService ${archivedAgreement.eserviceId} - Descriptor state is not in relevant state (state: ${descriptor.state})`
        );
      }
    )
    .exhaustive();
}
