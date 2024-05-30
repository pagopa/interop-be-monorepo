/* eslint-disable max-params */
import {
  AuthData,
  CreateEvent,
  FileManager,
  Logger,
  PDFGenerator,
} from "pagopa-interop-commons";
import {
  Agreement,
  EService,
  Tenant,
  agreementState,
  AgreementEvent,
  AgreementState,
  Descriptor,
  genericError,
  AgreementEventV2,
  WithMetadata,
  UserId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { SelfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import {
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  agreementArchivableStates,
} from "../model/domain/validators.js";
import {
  toCreateEventAgreementActivated,
  toCreateEventAgreementSuspendedByPlatform,
  toCreateEventAgreementUnsuspendedByConsumer,
  toCreateEventAgreementUnsuspendedByPlatform,
  toCreateEventAgreementUnsuspendedByProducer,
} from "../model/domain/toEvent.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import { apiAgreementDocumentToAgreementDocument } from "../model/domain/apiConverter.js";
import { config } from "../utilities/config.js";
import {
  createStamp,
  suspendedByConsumerStamp,
  suspendedByProducerStamp,
} from "./agreementStampUtils.js";
import { createAgreementArchivedByUpgradeEvent } from "./agreementService.js";
import { ReadModelService } from "./readModelService.js";
import { contractBuilder } from "./agreementContractBuilder.js";

export function createActivationUpdateAgreementSeed({
  firstActivation,
  newState,
  descriptor,
  consumer,
  eservice,
  authData,
  agreement,
  suspendedByConsumer,
  suspendedByProducer,
  suspendedByPlatform,
}: {
  firstActivation: boolean;
  newState: AgreementState;
  descriptor: Descriptor;
  consumer: Tenant;
  eservice: EService;
  authData: AuthData;
  agreement: Agreement;
  suspendedByConsumer: boolean | undefined;
  suspendedByProducer: boolean | undefined;
  suspendedByPlatform: boolean | undefined;
}): UpdateAgreementSeed {
  const stamp = createStamp(authData.userId);

  return firstActivation
    ? {
        state: newState,
        certifiedAttributes: matchingCertifiedAttributes(descriptor, consumer),
        declaredAttributes: matchingDeclaredAttributes(descriptor, consumer),
        verifiedAttributes: matchingVerifiedAttributes(
          eservice,
          descriptor,
          consumer
        ),
        suspendedByConsumer,
        suspendedByProducer,
        suspendedByPlatform,
        stamps: {
          ...agreement.stamps,
          activation: stamp,
        },
      }
    : {
        state: newState,
        suspendedByConsumer,
        suspendedByProducer,
        stamps: {
          ...agreement.stamps,
          suspensionByConsumer: suspendedByConsumerStamp(
            agreement,
            authData.organizationId,
            agreementState.active,
            stamp
          ),
          suspensionByProducer: suspendedByProducerStamp(
            agreement,
            authData.organizationId,
            agreementState.active,
            stamp
          ),
        },
        suspendedByPlatform,
        suspendedAt:
          newState === agreementState.active
            ? undefined
            : agreement.suspendedAt,
      };
}

export async function createActivationEvent(
  firstActivation: boolean,
  agreement: WithMetadata<Agreement>,
  updatedAgreement: Agreement,
  authData: AuthData,
  correlationId: string
): Promise<Array<CreateEvent<AgreementEventV2>>> {
  if (firstActivation) {
    return [
      toCreateEventAgreementActivated(
        updatedAgreement,
        agreement.metadata.version,
        correlationId
      ),
    ];
  } else {
    return match([authData.organizationId, updatedAgreement.state])
      .with([agreement.data.producerId, agreementState.active], () => [
        toCreateEventAgreementUnsuspendedByProducer(
          updatedAgreement,
          agreement.metadata.version,
          correlationId
        ),
      ])
      .with([agreement.data.producerId, agreementState.suspended], () => [
        toCreateEventAgreementUnsuspendedByProducer(
          {
            ...updatedAgreement,
            suspendedByPlatform: agreement.data.suspendedByPlatform,
          },
          agreement.metadata.version,
          correlationId
        ),
        ...maybeCreateSuspensionByPlatformEvents(
          agreement,
          updatedAgreement,
          correlationId
        ),
      ])
      .with([agreement.data.consumerId, agreementState.active], () => [
        toCreateEventAgreementUnsuspendedByConsumer(
          updatedAgreement,
          agreement.metadata.version,
          correlationId
        ),
      ])
      .with([agreement.data.consumerId, agreementState.suspended], () => [
        toCreateEventAgreementUnsuspendedByConsumer(
          {
            ...updatedAgreement,
            suspendedByPlatform: agreement.data.suspendedByPlatform,
          },
          agreement.metadata.version,
          correlationId
        ),
        ...maybeCreateSuspensionByPlatformEvents(
          agreement,
          updatedAgreement,
          correlationId
        ),
      ])
      .otherwise(() => {
        throw genericError(
          `Unexpected organizationId - nextState pair in activateAgreement. OrganizationId: ${authData.organizationId} - nextState: ${updatedAgreement.state}`
        );
      });
  }
}

export const archiveRelatedToAgreements = async (
  agreement: Agreement,
  userId: UserId,
  readModelService: ReadModelService,
  correlationId: string
): Promise<Array<CreateEvent<AgreementEvent>>> => {
  const existingAgreements = await readModelService.getAllAgreements({
    consumerId: agreement.consumerId,
    eserviceId: agreement.eserviceId,
  });

  const archivables = existingAgreements.filter(
    (a) =>
      agreementArchivableStates.includes(a.data.state) &&
      a.data.id !== agreement.id
  );

  return archivables.map((agreementData) =>
    createAgreementArchivedByUpgradeEvent(agreementData, userId, correlationId)
  );
};

export function maybeCreateSuspensionByPlatformEvents(
  agreement: WithMetadata<Agreement>,
  updatedAgreement: Agreement,
  correlationId: string
): Array<CreateEvent<AgreementEventV2>> {
  if (
    updatedAgreement.suspendedByPlatform !==
      agreement.data.suspendedByPlatform &&
    updatedAgreement.state === agreementState.suspended
  ) {
    return updatedAgreement.suspendedByPlatform
      ? [
          toCreateEventAgreementSuspendedByPlatform(
            updatedAgreement,
            agreement.metadata.version + 1,
            correlationId
          ),
        ]
      : [
          toCreateEventAgreementUnsuspendedByPlatform(
            updatedAgreement,
            agreement.metadata.version + 1,
            correlationId
          ),
        ];
  }
  return [];
}

export async function createActivationContract(
  agreement: WithMetadata<Agreement>,
  firstActivation: boolean,
  readModelService: ReadModelService,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  selfcareV2Client: SelfcareV2Client,
  logger: Logger,
  authData: AuthData,
  updatedAgreementWithoutContract: Agreement,
  updatedAgreementSeed: UpdateAgreementSeed,
  eservice: EService,
  consumer: Tenant,
  producer: Tenant
): Promise<Agreement["contract"]> {
  if (!firstActivation) {
    return agreement.data.contract;
  }

  const { contractSeed, createdAt } = await contractBuilder(
    readModelService,
    pdfGenerator,
    fileManager,
    selfcareV2Client,
    config,
    logger
  ).createContract(
    authData.selfcareId,
    updatedAgreementWithoutContract,
    eservice,
    consumer,
    producer,
    updatedAgreementSeed
  );

  return apiAgreementDocumentToAgreementDocument(contractSeed, createdAt);
}
