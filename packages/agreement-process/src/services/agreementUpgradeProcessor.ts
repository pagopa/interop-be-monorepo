import { FileManager, Logger, CreateEvent } from "pagopa-interop-commons";
import {
  WithMetadata,
  Agreement,
  DescriptorId,
  AgreementEvent,
  agreementState,
  generateId,
  AgreementId,
  UserId,
} from "pagopa-interop-models";
import {
  toCreateEventAgreementArchivedByUpgrade,
  toCreateEventAgreementUpgraded,
  toCreateEventAgreementAdded,
} from "../model/domain/toEvent.js";
import { verifyConflictingAgreements } from "../model/domain/validators.js";
import { createStamp } from "./agreementStampUtils.js";
import { createAndCopyDocumentsForClonedAgreement } from "./agreementService.js";
import { ReadModelService } from "./readModelService.js";

export async function createUpgradeOrNewDraft({
  agreement,
  descriptorId,
  readModelService,
  canBeUpgraded,
  copyFile,
  userId,
  correlationId,
  logger,
}: {
  agreement: WithMetadata<Agreement>;
  descriptorId: DescriptorId;
  readModelService: ReadModelService;
  canBeUpgraded: boolean;
  copyFile: FileManager["copy"];
  userId: UserId;
  correlationId: string;
  logger: Logger;
}): Promise<[Agreement, Array<CreateEvent<AgreementEvent>>]> {
  if (canBeUpgraded) {
    // upgradeAgreement
    const stamp = createStamp(userId);
    const archived: Agreement = {
      ...agreement.data,
      state: agreementState.archived,
      stamps: {
        ...agreement.data.stamps,
        archiving: stamp,
      },
    };
    const newAgreementId = generateId<AgreementId>();
    const upgraded: Agreement = {
      ...agreement.data,
      id: newAgreementId,
      descriptorId,
      createdAt: new Date(),
      updatedAt: undefined,
      rejectionReason: undefined,
      stamps: {
        ...agreement.data.stamps,
        upgrade: stamp,
      },
      consumerDocuments: await createAndCopyDocumentsForClonedAgreement(
        newAgreementId,
        agreement.data,
        copyFile,
        logger
      ),
    };

    return [
      upgraded,
      [
        toCreateEventAgreementArchivedByUpgrade(
          archived,
          agreement.metadata.version,
          correlationId
        ),
        toCreateEventAgreementUpgraded(upgraded, correlationId),
      ],
    ];
  } else {
    // createNewDraftAgreement
    await verifyConflictingAgreements(
      agreement.data.consumerId,
      agreement.data.eserviceId,
      [agreementState.draft],
      readModelService
    );

    const id = generateId<AgreementId>();
    const newAgreement: Agreement = {
      id,
      state: agreementState.draft,
      createdAt: new Date(),
      descriptorId,
      eserviceId: agreement.data.eserviceId,
      producerId: agreement.data.producerId,
      consumerId: agreement.data.consumerId,
      consumerNotes: agreement.data.consumerNotes,
      consumerDocuments: await createAndCopyDocumentsForClonedAgreement(
        id,
        agreement.data,
        copyFile,
        logger
      ),
      stamps: {},
      // TODO should we bring attributes with us?
      // It should not have attributes, if it was never activaetd
      verifiedAttributes: agreement.data.verifiedAttributes,
      certifiedAttributes: agreement.data.certifiedAttributes,
      declaredAttributes: agreement.data.declaredAttributes,
      contract: undefined,
      suspendedAt: undefined,
      // suspendedByConsumer: undefined,
      // suspendedByPlatform: undefined,
      // suspendedByProducer: undefined,
      suspendedByConsumer: agreement.data.suspendedByConsumer,
      suspendedByPlatform: agreement.data.suspendedByPlatform,
      suspendedByProducer: agreement.data.suspendedByProducer,
      updatedAt: undefined,
      rejectionReason: undefined,
    };

    const createEvent = toCreateEventAgreementAdded(
      newAgreement,
      correlationId
    );

    return [newAgreement, [createEvent]];
  }
}
