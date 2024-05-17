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
  AgreementEvent,
  SelfcareId,
  AgreementState,
  Descriptor,
  genericError,
  AgreementEventV2,
  WithMetadata,
} from "pagopa-interop-models";
import {
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
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
/* eslint-disable max-params */
import { contractBuilder } from "./agreementContractBuilder.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";
import {
  createStamp,
  suspendedByConsumerStamp,
  suspendedByProducerStamp,
} from "./agreementStampUtils.js";
import { AttributeQuery } from "./readmodel/attributeQuery.js";
import { retrieveTenant } from "./agreementService.js";

export function createUpdateAgreementSeed({
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
}

export const archiveRelatedToAgreements = async (
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

export const createContract = async (
  agreement: Agreement,
  updateSeed: UpdateAgreementSeed,
  eservice: EService,
  consumer: Tenant,
  attributeQuery: AttributeQuery,
  tenantQuery: TenantQuery,
  selfcareId: SelfcareId,
  storeFile: FileManager["storeBytes"],
  logger: Logger
): Promise<ApiAgreementDocumentSeed> => {
  const producer = await retrieveTenant(agreement.producerId, tenantQuery);

  return await contractBuilder(
    selfcareId,
    attributeQuery,
    storeFile,
    logger
  ).createContract(agreement, eservice, consumer, producer, updateSeed);
};

export async function createActivationEvent({
  firstActivation,
  agreement,
  updatedAgreement,
  updatedAgreementSeed,
  eservice,
  consumer,
  authData,
  correlationId,
  attributeQuery,
  tenantQuery,
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
  attributeQuery: AttributeQuery;
  tenantQuery: TenantQuery;
  storeFile: FileManager["storeBytes"];
  logger: Logger;
}): Promise<CreateEvent<AgreementEventV2>> {
  if (firstActivation) {
    const contract = apiAgreementDocumentToAgreementDocument(
      await createContract(
        updatedAgreement,
        updatedAgreementSeed,
        eservice,
        consumer,
        attributeQuery,
        tenantQuery,
        authData.selfcareId,
        storeFile,
        logger
      )
    );
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
