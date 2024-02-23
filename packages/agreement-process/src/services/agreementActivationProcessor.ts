/* eslint-disable max-params */
import { AuthData, CreateEvent, FileManager } from "pagopa-interop-commons";
import {
  Agreement,
  Descriptor,
  EService,
  Tenant,
  agreementState,
  WithMetadata,
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
  storeFile: FileManager["storeBytes"]
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

  const tenant = await tenantQuery.getTenantById(agreement.data.consumerId);
  assertTenantExist(agreement.data.consumerId, tenant);

  return activateAgreement(
    agreement,
    eservice.data,
    descriptor,
    tenant.data,
    authData,
    tenantQuery,
    agreementQuery,
    attributeQuery,
    storeFile
  );
}

async function activateAgreement(
  agreementData: WithMetadata<Agreement>,
  eService: EService,
  descriptor: Descriptor,
  consumer: Tenant,
  authData: AuthData,
  tenantQuery: TenantQuery,
  agreementQuery: AgreementQuery,
  attributeQuery: AttributeQuery,
  storeFile: FileManager["storeBytes"]
): Promise<Array<CreateEvent<AgreementEvent>>> {
  const agreement = agreementData.data;
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
  const suspendedByPlatform = suspendedByPlatformFlag(nextAttributesState);

  const newState = agreementStateByFlags(
    nextAttributesState,
    suspendedByProducer,
    suspendedByConsumer,
    suspendedByPlatform
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
          eService,
          descriptor,
          consumer
        ),
        suspendedByConsumer,
        suspendedByProducer,
        suspendedByPlatform,
        stamps: {
          ...agreement.stamps,
          activation: createStamp(authData),
        },
      }
    : {
        state: newState,
        suspendedByConsumer,
        suspendedByProducer,
        suspendedByPlatform,
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

  const updateAgreementEvent = toCreateEventAgreementUpdated(
    updatedAgreement,
    agreementData.metadata.version
  );

  if (firstActivation) {
    await createContract(
      updatedAgreement,
      updatedAgreementSeed,
      eService,
      consumer,
      attributeQuery,
      tenantQuery,
      storeFile
    );
  }

  const archiveEvents = await archiveRelatedToAgreements(
    agreement,
    authData,
    agreementQuery
  );

  return [updateAgreementEvent, ...archiveEvents];
}

const archiveRelatedToAgreements = async (
  agreement: Agreement,
  authData: AuthData,
  agreementQuery: AgreementQuery
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
      agreementData.metadata.version
    )
  );
};

const createContract = async (
  agreement: Agreement,
  updateSeed: UpdateAgreementSeed,
  eService: EService,
  consumer: Tenant,
  attributeQuery: AttributeQuery,
  tenantQuery: TenantQuery,
  storeFile: FileManager["storeBytes"]
): Promise<void> => {
  const producer = await tenantQuery.getTenantById(agreement.producerId);
  assertTenantExist(agreement.producerId, producer);

  await contractBuilder(attributeQuery, storeFile).createContract(
    agreement,
    eService,
    consumer,
    producer.data,
    updateSeed
  );
};
