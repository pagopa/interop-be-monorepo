/* eslint-disable max-params */
import { AuthData, CreateEvent } from "pagopa-interop-commons";
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
import {
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  agreementArchivableStates,
} from "../model/domain/validators.js";
import {
  toCreateEventAgreementActivated,
  toCreateEventAgreementUnsuspendedByConsumer,
  toCreateEventAgreementUnsuspendedByProducer,
} from "../model/domain/toEvent.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import { apiAgreementDocumentToAgreementDocument } from "../model/domain/apiConverter.js";
import {
  createStamp,
  suspendedByConsumerStamp,
  suspendedByProducerStamp,
} from "./agreementStampUtils.js";
import { createAgreementArchivedByUpgradeEvent } from "./agreementService.js";
import { ReadModelService } from "./readModelService.js";
import { ContractBuilder } from "./agreementContractBuilder.js";

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
  updatedAgreementSeed: UpdateAgreementSeed,
  eservice: EService,
  consumer: Tenant,
  producer: Tenant,
  authData: AuthData,
  correlationId: string,
  contractBuilder: ContractBuilder
): Promise<CreateEvent<AgreementEventV2>> {
  if (firstActivation) {
    const agreementContract = await contractBuilder.createContract(
      authData.selfcareId,
      updatedAgreement,
      eservice,
      consumer,
      producer,
      updatedAgreementSeed
    );

    return toCreateEventAgreementActivated(
      {
        ...updatedAgreement,
        contract: apiAgreementDocumentToAgreementDocument(agreementContract),
      },
      agreement.metadata.version,
      correlationId
    );
  } else {
    if (authData.organizationId === agreement.data.producerId) {
      return toCreateEventAgreementUnsuspendedByProducer(
        updatedAgreement,
        agreement.metadata.version,
        correlationId
      );
    } else if (authData.organizationId === agreement.data.consumerId) {
      return toCreateEventAgreementUnsuspendedByConsumer(
        updatedAgreement,
        agreement.metadata.version,
        correlationId
      );
    } else {
      throw genericError(
        `Unexpected organizationId ${authData.organizationId} in activateAgreement`
      );
    }
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
