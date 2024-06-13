import { FileManager, Logger, CreateEvent } from "pagopa-interop-commons";
import {
  WithMetadata,
  Agreement,
  AgreementEvent,
  agreementState,
  generateId,
  AgreementId,
  UserId,
  Descriptor,
  EService,
  Tenant,
} from "pagopa-interop-models";
import {
  toCreateEventAgreementArchivedByUpgrade,
  toCreateEventAgreementUpgraded,
  toCreateEventAgreementAdded,
} from "../model/domain/toEvent.js";
import {
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  verifyConflictingAgreements,
} from "../model/domain/validators.js";
import { createStamp } from "./agreementStampUtils.js";
import { createAndCopyDocumentsForClonedAgreement } from "./agreementService.js";
import { ReadModelService } from "./readModelService.js";

export async function createUpgradeOrNewDraft({
  agreement,
  eservice,
  newDescriptor,
  consumer,
  readModelService,
  canBeUpgraded,
  copyFile,
  userId,
  correlationId,
  logger,
}: {
  agreement: WithMetadata<Agreement>;
  eservice: EService;
  newDescriptor: Descriptor;
  consumer: Tenant;
  readModelService: ReadModelService;
  canBeUpgraded: boolean;
  copyFile: FileManager["copy"];
  userId: UserId;
  correlationId: string;
  logger: Logger;
}): Promise<[Agreement, Array<CreateEvent<AgreementEvent>>]> {
  const newAgreementId = generateId<AgreementId>();
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
    const upgraded: Agreement = {
      id: newAgreementId,
      state: agreement.data.state,
      createdAt: new Date(),
      descriptorId: newDescriptor.id,
      eserviceId: agreement.data.eserviceId,
      producerId: agreement.data.producerId,
      consumerId: agreement.data.consumerId,
      consumerNotes: agreement.data.consumerNotes,
      consumerDocuments: await createAndCopyDocumentsForClonedAgreement(
        newAgreementId,
        agreement.data,
        copyFile,
        logger
      ),
      // TODO generate a new contract here - https://pagopa.atlassian.net/browse/IMN-622
      contract: agreement.data.contract,
      verifiedAttributes: matchingVerifiedAttributes(
        eservice,
        newDescriptor,
        consumer
      ),
      certifiedAttributes: matchingCertifiedAttributes(newDescriptor, consumer),
      declaredAttributes: matchingDeclaredAttributes(newDescriptor, consumer),
      suspendedByConsumer: agreement.data.suspendedByConsumer,
      suspendedByProducer: agreement.data.suspendedByProducer,
      suspendedAt: agreement.data.suspendedAt,
      suspendedByPlatform: undefined,
      updatedAt: undefined,
      rejectionReason: undefined,
      stamps: {
        ...agreement.data.stamps,
        upgrade: stamp,
      },
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

    const newAgreement: Agreement = {
      id: newAgreementId,
      state: agreementState.draft,
      createdAt: new Date(),
      descriptorId: newDescriptor.id,
      eserviceId: agreement.data.eserviceId,
      producerId: agreement.data.producerId,
      consumerId: agreement.data.consumerId,
      consumerNotes: agreement.data.consumerNotes,
      consumerDocuments: await createAndCopyDocumentsForClonedAgreement(
        newAgreementId,
        agreement.data,
        copyFile,
        logger
      ),
      suspendedByPlatform: undefined,
      updatedAt: undefined,
      rejectionReason: undefined,
      contract: undefined,
      verifiedAttributes: [],
      certifiedAttributes: [],
      declaredAttributes: [],
      /* We copy suspendedByProducer, suspendedByProducer, suspendedAt, and
      the corresponding stamps, even if this is a Draft Agreement and suspension
      should not make sense on a Draft Agreement.
      In this way, when the new agreement gets activated
      by the producer, it will be suspended right away if the original
      agreement was suspended by the consumer, and viceversa. */
      suspendedByConsumer: agreement.data.suspendedByConsumer,
      suspendedByProducer: agreement.data.suspendedByProducer,
      suspendedAt: agreement.data.suspendedAt,
      stamps: {
        suspensionByConsumer: agreement.data.stamps.suspensionByConsumer,
        suspensionByProducer: agreement.data.stamps.suspensionByProducer,
      },
    };

    const createEvent = toCreateEventAgreementAdded(
      newAgreement,
      correlationId
    );

    return [newAgreement, [createEvent]];
  }
}
