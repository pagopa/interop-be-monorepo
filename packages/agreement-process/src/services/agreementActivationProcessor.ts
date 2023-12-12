/* eslint-disable max-params */
import { utcToZonedTime } from "date-fns-tz";
import { AuthData, getContext, logger } from "pagopa-interop-commons";
import {
  Agreement,
  Descriptor,
  EService,
  Tenant,
  UpdateAgreementSeed,
  agreementState,
  agreementArchivableStates,
} from "pagopa-interop-models";
import {
  agreementNotFound,
  eServiceNotFound,
  tenantIdNotFound,
} from "../model/domain/errors.js";
import {
  assertAgreementExist,
  assertRequesterIsConsumerOrProducer,
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  validateActivationOnDescriptor,
  verifyAgreementActivation,
  verifyConsumerDoesNotActivatePending,
} from "../model/domain/validators.js";
import { ApiAgreementDocumentSeed } from "../model/types.js";
import {
  agreementStateByFlags,
  nextState,
  suspendedByConsumerFlag,
  suspendedByConsumerStamp,
  suspendedByPlatformFlag,
  suspendedByProducerFlag,
  suspendedByProducerStamp,
} from "./ageementStateProcessor.js";
import { contractBuilder } from "./agreementContractBuilder.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";

export async function activateAgreementLogic(
  agreementId: string,
  agreementQuery: AgreementQuery,
  eserviceQuery: EserviceQuery,
  tenantQuery: TenantQuery,
  authData: AuthData,
  addContract: (
    agreementId: string,
    seed: ApiAgreementDocumentSeed
  ) => Promise<void>
): Promise<Agreement> {
  logger.info(`Activating agreement ${agreementId}`);
  const { organizationId, userId } = authData;

  const agreement = await agreementQuery.getAgreementById(agreementId);

  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumerOrProducer(organizationId, agreement.data);
  verifyConsumerDoesNotActivatePending(agreement.data, organizationId);
  verifyAgreementActivation(agreement.data);

  const eservice = await eserviceQuery.getEServiceById(
    agreement.data.eserviceId
  );
  if (!eservice) {
    throw eServiceNotFound(agreement.data.eserviceId);
  }

  const descriptor = validateActivationOnDescriptor(
    eservice.data,
    agreement.data.descriptorId
  );

  const consumer = await tenantQuery.getTenantById(agreement.data.consumerId);
  if (!consumer) {
    throw tenantIdNotFound(agreement.data.consumerId);
  }

  return activateAgreement(
    agreement.data,
    eservice.data,
    descriptor,
    consumer.data,
    organizationId,
    userId,
    tenantQuery,
    agreementQuery,
    addContract
  );
}

async function activateAgreement(
  agreement: Agreement,
  eService: EService,
  descriptor: Descriptor,
  consumer: Tenant,
  requesterOrgId: string,
  userId: string,
  tenantQuery: TenantQuery,
  agreementQuery: AgreementQuery,
  addContract: (
    agreementId: string,
    seed: ApiAgreementDocumentSeed
  ) => Promise<void>
): Promise<Agreement> {
  const nextAttributesState = nextState(agreement, descriptor, consumer);

  const suspendedByConsumer = suspendedByConsumerFlag(
    agreement,
    requesterOrgId,
    agreementState.active
  );
  const suspendedByProducer = suspendedByProducerFlag(
    agreement,
    requesterOrgId,
    agreementState.active
  );
  const suspendedByPlatform = suspendedByPlatformFlag(nextAttributesState);

  const newState = agreementStateByFlags(
    nextAttributesState,
    suspendedByProducer,
    suspendedByConsumer,
    suspendedByPlatform
  );

  const firstActivation =
    agreement.state === agreementState.pending &&
    newState === agreementState.active;

  const agreementSeed: UpdateAgreementSeed = firstActivation
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
          activation: {
            who: requesterOrgId,
            when: utcToZonedTime(new Date(), "Etc/UTC"),
          },
        },
      }
    : {
        state: newState,
        certifiedAttributes: agreement.certifiedAttributes,
        declaredAttributes: agreement.declaredAttributes,
        verifiedAttributes: agreement.verifiedAttributes,
        suspendedByConsumer,
        suspendedByProducer,
        suspendedByPlatform,
        stamps: {
          ...agreement.stamps,
          suspensionByConsumer: suspendedByConsumerStamp(
            agreement,
            requesterOrgId,
            agreementState.active,
            userId
          ),
          suspensionByProducer: suspendedByProducerStamp(
            agreement,
            requesterOrgId,
            agreementState.active,
            userId
          ),
        },
        suspendedAt:
          newState === agreementState.active
            ? undefined
            : agreement.suspendedAt,
      };

  const createContract = async (
    seed: UpdateAgreementSeed,
    agreement: Agreement
  ): Promise<void> => {
    const producer = await tenantQuery.getTenantById(agreement.producerId);
    if (!producer) {
      throw tenantIdNotFound(500, agreement.producerId);
    }

    const contract = await contractBuilder.createContract(
      agreement,
      eService,
      consumer,
      producer.data,
      seed
    );

    await addContract(agreement.id, contract);
  };

  const existingAgreements = await agreementQuery.getAgreements({
    consumerId: agreement.consumerId,
    eserviceId: agreement.eserviceId,
  });

  const archivables = getArchivables(agreement.id, existingAgreements);

  agreementManagementService.updateAgreement(agreement.id, agreementSeed);
  // 🩸🩸🩸🩸🩸🩸🩸🩸🩸
}

const getArchivables = (
  activatingAgreementId: string,
  agreements: Agreement[]
): Agreement[] =>
  agreements.filter(
    (a) =>
      agreementArchivableStates.includes() && a.id !== activatingAgreementId
  );
