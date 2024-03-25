/* eslint-disable max-params */
import { AuthData, CreateEvent, FileManager } from "pagopa-interop-commons";
import {
  Agreement,
  EService,
  Tenant,
  agreementState,
  AgreementEvent,
  AgreementUpdateEvent,
  AgreementId,
} from "pagopa-interop-models";
import {
  assertAgreementExist,
  assertRequesterIsConsumerOrProducer,
  assertTenantExist,
  failOnActivationFailure,
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  validateActivationOnDescriptor,
  assertActivableState,
  verifyConsumerDoesNotActivatePending,
  assertEServiceExist,
  agreementArchivableStates,
} from "../model/domain/validators.js";
import { toCreateEventAgreementUpdated } from "../model/domain/toEvent.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import {
  agreementStateByFlags,
  nextState,
  suspendedByConsumerFlag,
  suspendedByPlatformFlag,
  suspendedByProducerFlag,
} from "./agreementStateProcessor.js";
import { contractBuilder } from "./agreementContractBuilder.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";
import {
  createStamp,
  suspendedByConsumerStamp,
  suspendedByProducerStamp,
} from "./agreementStampUtils.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";

export async function activateAgreementLogic(
  agreementId: AgreementId,
  agreementQuery: AgreementQuery,
  eserviceQuery: EserviceQuery,
  tenantQuery: TenantQuery,
  attributeQuery: AttributeQuery,
  authData: AuthData,
  storeFile: FileManager["storeBytes"],
  correlationId: string
): Promise<Array<CreateEvent<AgreementEvent>>> {
  const agreement = await agreementQuery.getAgreementById(agreementId);
  assertAgreementExist(agreementId, agreement);

  assertRequesterIsConsumerOrProducer(agreement.data, authData);
  verifyConsumerDoesNotActivatePending(agreement.data, authData);
  assertActivableState(agreement.data);

  const eservice = await eserviceQuery.getEServiceById(
    agreement.data.eserviceId
  );
  assertEServiceExist(agreement.data.eserviceId, eservice);

  const descriptor = validateActivationOnDescriptor(
    eservice.data,
    agreement.data.descriptorId
  );

  const consumer = await tenantQuery.getTenantById(agreement.data.consumerId);
  assertTenantExist(agreement.data.consumerId, consumer);

  const nextAttributesState = nextState(
    agreement.data,
    descriptor,
    consumer.data
  );

  const suspendedByConsumer = suspendedByConsumerFlag(
    agreement.data,
    authData.organizationId,
    agreementState.active
  );
  const suspendedByProducer = suspendedByProducerFlag(
    agreement.data,
    authData.organizationId,
    agreementState.active
  );
  const suspendedByPlatform = suspendedByPlatformFlag(nextAttributesState);

  const newState = agreementStateByFlags(
    nextAttributesState,
    suspendedByProducer,
    suspendedByConsumer,
    suspendedByPlatform
  );

  failOnActivationFailure(newState, agreement.data);

  const firstActivation =
    agreement.data.state === agreementState.pending &&
    newState === agreementState.active;

  const updatedAgreementSeed: UpdateAgreementSeed = firstActivation
    ? {
        state: newState,
        certifiedAttributes: matchingCertifiedAttributes(
          descriptor,
          consumer.data
        ),
        declaredAttributes: matchingDeclaredAttributes(
          descriptor,
          consumer.data
        ),
        verifiedAttributes: matchingVerifiedAttributes(
          eservice.data,
          descriptor,
          consumer.data
        ),
        suspendedByConsumer,
        suspendedByProducer,
        suspendedByPlatform,
        stamps: {
          ...agreement.data.stamps,
          activation: createStamp(authData),
        },
      }
    : {
        state: newState,
        suspendedByConsumer,
        suspendedByProducer,
        suspendedByPlatform,
        stamps: {
          ...agreement.data.stamps,
          suspensionByConsumer: suspendedByConsumerStamp(
            agreement.data,
            authData.organizationId,
            agreementState.active,
            createStamp(authData)
          ),
          suspensionByProducer: suspendedByProducerStamp(
            agreement.data,
            authData.organizationId,
            agreementState.active,
            createStamp(authData)
          ),
        },
        suspendedAt:
          newState === agreementState.active
            ? undefined
            : agreement.data.suspendedAt,
      };

  const updatedAgreement = {
    ...agreement.data,
    ...updatedAgreementSeed,
  };

  const updateAgreementEvent = toCreateEventAgreementUpdated(
    updatedAgreement,
    agreement.metadata.version,
    correlationId
  );

  if (firstActivation) {
    await createContract(
      updatedAgreement,
      updatedAgreementSeed,
      eservice.data,
      consumer.data,
      attributeQuery,
      tenantQuery,
      storeFile
    );
  }

  const archiveEvents = await archiveRelatedToAgreements(
    agreement.data,
    authData,
    agreementQuery,
    correlationId
  );

  return [updateAgreementEvent, ...archiveEvents];
}

const archiveRelatedToAgreements = async (
  agreement: Agreement,
  authData: AuthData,
  agreementQuery: AgreementQuery,
  correlationId: string
): Promise<Array<CreateEvent<AgreementUpdateEvent>>> => {
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
    toCreateEventAgreementUpdated(
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
  attributeQuery: AttributeQuery,
  tenantQuery: TenantQuery,
  storeFile: FileManager["storeBytes"]
): Promise<void> => {
  const producer = await tenantQuery.getTenantById(agreement.producerId);
  assertTenantExist(agreement.producerId, producer);

  await contractBuilder(attributeQuery, storeFile).createContract(
    agreement,
    eservice,
    consumer,
    producer.data,
    updateSeed
  );
};
