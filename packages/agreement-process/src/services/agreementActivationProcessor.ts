/* eslint-disable max-params */
import {
  AuthData,
  CreateEvent,
  FileManager,
  Logger,
} from "pagopa-interop-commons";
import {
  Agreement,
  EService,
  Tenant,
  agreementState,
  WithMetadata,
  AgreementEvent,
  SelfcareId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  failOnActivationFailure,
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  validateActivationOnDescriptor,
  agreementArchivableStates,
} from "../model/domain/validators.js";
import {
  toCreateEventAgreementActivated,
  toCreateEventAgreementArchivedByUpgrade,
  toCreateEventAgreementUnsuspendedByConsumer,
  toCreateEventAgreementUnsuspendedByProducer,
} from "../model/domain/toEvent.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import { ApiAgreementDocumentSeed } from "../model/types.js";
import { apiAgreementDocumentToAgreementDocument } from "../model/domain/apiConverter.js";
import {
  agreementStateByFlags,
  nextState,
  suspendedByConsumerFlag,
  suspendedByProducerFlag,
} from "./agreementStateProcessor.js";
import { contractBuilder } from "./agreementContractBuilder.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import {
  createStamp,
  suspendedByConsumerStamp,
  suspendedByProducerStamp,
} from "./agreementStampUtils.js";
import { retrieveTenant } from "./agreementService.js";
import { ReadModelService } from "./readmodel/readModelService.js";

export async function processActivateAgreement({
  agreementData,
  eservice,
  authData,
  readModelService,
  agreementQuery,
  storeFile,
  correlationId,
  logger,
}: {
  agreementData: WithMetadata<Agreement>;
  eservice: EService;
  authData: AuthData;
  readModelService: ReadModelService;
  agreementQuery: AgreementQuery;
  storeFile: FileManager["storeBytes"];
  correlationId: string;
  logger: Logger;
}): Promise<[Agreement, Array<CreateEvent<AgreementEvent>>]> {
  const agreement = agreementData.data;

  const descriptor = validateActivationOnDescriptor(
    eservice,
    agreement.descriptorId
  );

  const consumer = await retrieveTenant(agreement.consumerId, readModelService);

  const nextAttributesState = nextState(agreement, descriptor, consumer);

  const suspendedByConsumer = suspendedByConsumerFlag(
    agreement,
    authData.organizationId,
    agreementState.active
  );
  const suspendedByProducer = suspendedByProducerFlag(
    agreement,
    authData.organizationId,
    agreementState.active
  );

  const newState = agreementStateByFlags(
    nextAttributesState,
    suspendedByProducer,
    suspendedByConsumer
  );

  failOnActivationFailure(newState, agreement);

  const firstActivation =
    agreement.state === agreementState.pending &&
    newState === agreementState.active;

  const updatedAgreementSeed: UpdateAgreementSeed = firstActivation
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
        stamps: {
          ...agreement.stamps,
          activation: createStamp(authData),
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
            createStamp(authData)
          ),
          suspensionByProducer: suspendedByProducerStamp(
            agreement,
            authData.organizationId,
            agreementState.active,
            createStamp(authData)
          ),
        },
        suspendedAt:
          newState === agreementState.active
            ? undefined
            : agreement.suspendedAt,
      };

  const updatedAgreement = {
    ...agreement,
    ...updatedAgreementSeed,
  };

  const activationEvent = await match(firstActivation)
    .with(true, async () => {
      const contract = apiAgreementDocumentToAgreementDocument(
        await createContract(
          updatedAgreement,
          updatedAgreementSeed,
          eservice,
          consumer,
          readModelService,
          authData.selfcareId,
          storeFile,
          logger
        )
      );

      return toCreateEventAgreementActivated(
        { ...updatedAgreement, contract },
        agreementData.metadata.version,
        correlationId
      );
    })
    .with(false, () => {
      if (authData.organizationId === agreement.producerId) {
        return toCreateEventAgreementUnsuspendedByProducer(
          updatedAgreement,
          agreementData.metadata.version,
          correlationId
        );
      } else if (authData.organizationId === agreement.consumerId) {
        return toCreateEventAgreementUnsuspendedByConsumer(
          updatedAgreement,
          agreementData.metadata.version,
          correlationId
        );
      } else {
        throw new Error(
          `Unexpected organizationId ${authData.organizationId} in activateAgreement`
        );
      }
    })
    .exhaustive();

  const archiveEvents = await archiveRelatedToAgreements(
    agreement,
    authData,
    agreementQuery,
    correlationId
  );

  return [updatedAgreement, [activationEvent, ...archiveEvents]];
}

const archiveRelatedToAgreements = async (
  agreement: Agreement,
  authData: AuthData,
  agreementQuery: AgreementQuery,
  correlationId: string
): Promise<Array<CreateEvent<AgreementEvent>>> => {
  const existingAgreements = await agreementQuery.getAllAgreements({
    consumerId: agreement.consumerId,
    eserviceId: agreement.eserviceId,
  });

  const archivables = existingAgreements.filter(
    (a) =>
      agreementArchivableStates.includes(a.data.state) &&
      a.data.id !== agreement.id
  );

  return archivables.map((agreementData) =>
    toCreateEventAgreementArchivedByUpgrade(
      {
        ...agreementData.data,
        state: agreementState.archived,
        certifiedAttributes: agreementData.data.certifiedAttributes,
        declaredAttributes: agreementData.data.declaredAttributes,
        verifiedAttributes: agreementData.data.verifiedAttributes,
        suspendedByConsumer: agreementData.data.suspendedByConsumer,
        suspendedByProducer: agreementData.data.suspendedByProducer,
        suspendedByPlatform: agreementData.data.suspendedByPlatform,
        stamps: {
          ...agreementData.data.stamps,
          archiving: createStamp(authData),
        },
      },
      agreementData.metadata.version,
      correlationId
    )
  );
};

const createContract = async (
  agreement: Agreement,
  updateSeed: UpdateAgreementSeed,
  eservice: EService,
  consumer: Tenant,
  readModelService: ReadModelService,
  selfcareId: SelfcareId,
  storeFile: FileManager["storeBytes"],
  logger: Logger
): Promise<ApiAgreementDocumentSeed> => {
  const producer = await retrieveTenant(agreement.producerId, readModelService);

  return await contractBuilder(
    selfcareId,
    readModelService,
    storeFile,
    logger
  ).createContract(agreement, eservice, consumer, producer, updateSeed);
};
