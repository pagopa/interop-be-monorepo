import {
  AuthData,
  CreateEvent,
  FileManager,
  Logger,
  PDFGenerator,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEvent,
  AgreementId,
  Descriptor,
  EService,
  SelfcareId,
  Tenant,
  WithMetadata,
  agreementState,
} from "pagopa-interop-models";
import {
  agreementArchivableStates,
  assertActivableState,
  assertAgreementExist,
  assertEServiceExist,
  assertRequesterIsConsumerOrProducer,
  assertTenantExist,
  failOnActivationFailure,
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  validateActivationOnDescriptor,
  verifyConsumerDoesNotActivatePending,
} from "../model/domain/validators.js";
import {
  toCreateEventAgreementActivated,
  toCreateEventAgreementUnsuspendedByConsumer,
  toCreateEventAgreementUnsuspendedByProducer,
} from "../model/domain/toEvent.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import { ApiAgreementDocumentSeed } from "../model/types.js";
import { apiAgreementDocumentToAgreementDocument } from "../model/domain/apiConverter.js";
import { AgreementProcessConfig } from "../utilities/config.js";
import { contractBuilder } from "./agreementContractBuilder.js";
import {
  suspendedByConsumerStamp,
  suspendedByProducerStamp,
} from "./agreementStampUtils.js";
import {
  agreementStateByFlags,
  nextState,
  suspendedByConsumerFlag,
  suspendedByProducerFlag,
} from "./agreementStateProcessor.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";

export async function activateAgreementLogic(
  agreementId: AgreementId,
  agreementQuery: AgreementQuery,
  eserviceQuery: EserviceQuery,
  tenantQuery: TenantQuery,
  attributeQuery: AttributeQuery,
  authData: AuthData,
  correlationId: string,
  fileManager: FileManager,
  pdfGenerator: PDFGenerator,
  config: AgreementProcessConfig,
  logger: Logger
): Promise<[Agreement, Array<CreateEvent<AgreementEvent>>]> {
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
    eservice,
    agreement.data.descriptorId
  );

  const tenant = await tenantQuery.getTenantById(agreement.data.consumerId);
  assertTenantExist(agreement.data.consumerId, tenant);

  return activateAgreement(
    agreement,
    eservice,
    descriptor,
    tenant,
    authData,
    tenantQuery,
    agreementQuery,
    attributeQuery,
    correlationId,
    fileManager,
    pdfGenerator,
    config,
    logger
  );
}

async function activateAgreement(
  agreementData: WithMetadata<Agreement>,
  eservice: EService,
  descriptor: Descriptor,
  consumer: Tenant,
  authData: AuthData,
  tenantQuery: TenantQuery,
  agreementQuery: AgreementQuery,
  attributeQuery: AttributeQuery,
  correlationId: string,
  fileManager: FileManager,
  pdfGenerator: PDFGenerator,
  config: AgreementProcessConfig,
  logger: Logger
): Promise<[Agreement, Array<CreateEvent<AgreementEvent>>]> {
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
          attributeQuery,
          tenantQuery,
          authData.selfcareId,
          fileManager,
          pdfGenerator,
          config,
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

export async function createActivationEvent({
  firstActivation,
  agreement,
  updatedAgreement,
  updatedAgreementSeed,
  eservice,
  consumer,
  authData,
  correlationId,
  readModelService,
  storeFile,
  logger,
}: {
  firstActivation: boolean;
  agreement: WithMetadata<Agreement>;
  updatedAgreement: Agreement;
  updatedAgreementSeed: UpdateAgreementSeed;
  eservice: EService;
  consumer: Tenant;
  authData: AuthData;
  correlationId: string;
  readModelService: ReadModelService;
  storeFile: FileManager["storeBytes"];
  logger: Logger;
}): Promise<CreateEvent<AgreementEventV2>> {
  if (firstActivation) {
    const contract = await createContract({
      agreement: updatedAgreement,
      updateSeed: updatedAgreementSeed,
      eservice,
      consumer,
      readModelService,
      selfcareId: authData.selfcareId,
      storeFile,
      logger,
    });
    return toCreateEventAgreementActivated(
      { ...updatedAgreement, contract },
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

const createContract = async (
  agreement: Agreement,
  updateSeed: UpdateAgreementSeed,
  eservice: EService,
  consumer: Tenant,
  attributeQuery: AttributeQuery,
  tenantQuery: TenantQuery,
  selfcareId: SelfcareId,
  fileManager: FileManager,
  pdfGenerator: PDFGenerator,
  config: AgreementProcessConfig,
  logger: Logger
): Promise<ApiAgreementDocumentSeed> => {
  const producer = await tenantQuery.getTenantById(agreement.producerId);
  assertTenantExist(agreement.producerId, producer);

  return await contractBuilder(
    attributeQuery,
    pdfGenerator,
    fileManager,
    config,
    logger
  ).createContract(
    selfcareId,
    agreement,
    eservice,
    consumer,
    producer,
    updateSeed
  );
};
