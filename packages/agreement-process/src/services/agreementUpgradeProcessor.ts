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
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { createAndCopyDocumentsForClonedAgreement } from "./agreementService.js";

export async function createUpgradeOrNewDraft({
  agreement,
  descriptorId,
  agreementQuery,
  canBeUpgraded,
  copyFile,
  userId,
  correlationId,
  logger,
}: {
  agreement: WithMetadata<Agreement>;
  descriptorId: DescriptorId;
  agreementQuery: AgreementQuery;
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
      agreementQuery
    );

    const id = generateId<AgreementId>();
    const newAgreement: Agreement = {
      ...agreement.data,
      id,
      descriptorId,
      state: agreementState.draft,
      createdAt: new Date(),
      consumerDocuments: await createAndCopyDocumentsForClonedAgreement(
        id,
        agreement.data,
        copyFile,
        logger
      ),
      stamps: {},
    };

    const createEvent = toCreateEventAgreementAdded(
      newAgreement,
      correlationId
    );

    return [newAgreement, [createEvent]];
  }
}
