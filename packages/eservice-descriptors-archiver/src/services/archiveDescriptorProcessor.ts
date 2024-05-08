import { Logger } from "pagopa-interop-commons";
import {
  Agreement,
  DescriptorId,
  EServiceId,
  agreementState,
  descriptorState,
  genericInternalError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ReadModelService } from "./readModelService.js";

export async function archiveDescriptorForArchivedAgreement(
  archivedAgreement: Agreement,
  readModelService: ReadModelService,
  archiveDescriptor: (
    descriptorId: DescriptorId,
    eserviceId: EServiceId,
    correlationId: string | undefined | null
  ) => Promise<void>,
  logger: Logger,
  correlationId: string | undefined | null
): Promise<DescriptorId | undefined> {
  const relatingAgreements = (
    await readModelService.getAgreementsByEserviceAndDescriptorId(
      archivedAgreement.eserviceId,
      archivedAgreement.descriptorId
    )
  ).filter((a) => a.id !== archivedAgreement.id);

  const allArchived = [archivedAgreement, ...relatingAgreements].every(
    (a) => a.state === agreementState.archived
  );

  if (!allArchived) {
    logger.info(
      `Skipping descriptors archiviation - not all agreements are archived for Descriptor ${archivedAgreement.descriptorId} of EService ${archivedAgreement.eserviceId}`
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

  return await match(descriptor)
    .with({ state: descriptorState.deprecated }, async () => {
      await archiveDescriptor(
        archivedAgreement.descriptorId,
        archivedAgreement.eserviceId,
        correlationId
      );
      return archivedAgreement.descriptorId;
    })
    .with({ state: descriptorState.suspended }, async () => {
      const newerDescriptorExists = eservice.descriptors.some(
        (d) =>
          (d.state === descriptorState.published ||
            d.state === descriptorState.suspended) &&
          Number(d.version) > Number(descriptor.version)
      );
      if (newerDescriptorExists) {
        await archiveDescriptor(
          archivedAgreement.descriptorId,
          archivedAgreement.eserviceId,
          correlationId
        );
        return archivedAgreement.descriptorId;
      } else {
        logger.info(
          `Skipping descriptor archiviation for Descriptor ${archivedAgreement.descriptorId} of EService ${archivedAgreement.eserviceId} - Descriptor suspended but no newer Descriptor found`
        );
        return undefined;
      }
    })
    .otherwise(() => {
      logger.info(
        `Skipping descriptor archiviation for Descriptor ${archivedAgreement.descriptorId} of EService ${archivedAgreement.eserviceId} - Descriptor state is not Deprecated or Suspended (state: ${descriptor.state})`
      );
      return undefined;
    });
}
