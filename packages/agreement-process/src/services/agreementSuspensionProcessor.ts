import { AuthData, CreateEvent } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEvent,
  AgreementStamp,
  AgreementState,
  Tenant,
  UpdateAgreementSeed,
  agreementState,
  agreementSuspendableStates,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { utcToZonedTime } from "date-fns-tz";
import {
  assertAgreementExist,
  assertEServiceExist,
  assertExpectedState,
  assertRequesterIsConsumerOrProducer,
  assertTenantExist,
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
} from "../model/domain/validators.js";
import { descriptorNotFound } from "../model/domain/errors.js";
import { toCreateEventAgreementUpdated } from "../model/domain/toEvent.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import {
  agreementStateByFlags,
  nextState,
  suspendedByConsumerFlag,
  suspendedByPlatformFlag,
  suspendedByProducerFlag,
} from "./agreementStateProcessor.js";

export async function suspendAgreementLogic({
  agreementId,
  authData,
  agreementQuery,
  tenantQuery,
  eserviceQuery,
}: {
  agreementId: Agreement["id"];
  authData: AuthData;
  agreementQuery: AgreementQuery;
  tenantQuery: TenantQuery;
  eserviceQuery: EserviceQuery;
}): Promise<CreateEvent<AgreementEvent>> {
  const agreement = await agreementQuery.getAgreementById(agreementId);
  assertAgreementExist(agreementId, agreement);

  assertRequesterIsConsumerOrProducer(agreement.data, authData);

  assertExpectedState(
    agreementId,
    agreement.data.state,
    agreementSuspendableStates
  );

  const eService = await eserviceQuery.getEServiceById(
    agreement.data.eserviceId
  );
  assertEServiceExist(agreement.data.eserviceId, eService);

  const consumer = await tenantQuery.getTenantById(agreement.data.consumerId);
  assertTenantExist(agreement.data.consumerId, consumer);

  const descriptor = eService.data.descriptors.find(
    (d) => d.id === agreement.data.descriptorId
  );
  if (descriptor === undefined) {
    throw descriptorNotFound(eService.data.id, agreement.data.descriptorId);
  }

  const nextStateByAttributes = nextState(
    agreement.data,
    descriptor,
    consumer.data
  );

  const suspendedByConsumer = suspendedByConsumerFlag(
    agreement.data,
    authData.organizationId,
    nextStateByAttributes
  );
  const suspendedByProducer = suspendedByProducerFlag(
    agreement.data,
    authData.organizationId,
    nextStateByAttributes
  );
  const suspendedByPlatform = suspendedByPlatformFlag(nextStateByAttributes);
  const newState = agreementStateByFlags(
    nextStateByAttributes,
    suspendedByProducer,
    suspendedByConsumer,
    suspendedByPlatform
  );

  const stamp: AgreementStamp = {
    who: authData.userId,
    when: utcToZonedTime(new Date(), "Etc/UTC"),
  };

  const suspensionByProducerStamp = suspendedByProducerStamp(
    agreement.data,
    authData.organizationId,
    newState,
    stamp
  );

  const suspensionByConsumerStamp = suspendedByConsumerStamp(
    agreement.data,
    authData.organizationId,
    newState,
    stamp
  );

  const updateSeed: UpdateAgreementSeed = {
    state: newState,
    certifiedAttributes: matchingCertifiedAttributes(descriptor, consumer.data),
    declaredAttributes: matchingDeclaredAttributes(descriptor, consumer.data),
    verifiedAttributes: matchingVerifiedAttributes(
      eService.data,
      descriptor,
      consumer.data
    ),
    suspendedByConsumer,
    suspendedByProducer,
    suspendedByPlatform,
    stamps: {
      ...agreement.data.stamps,
      suspensionByConsumer: suspensionByConsumerStamp,
      suspensionByProducer: suspensionByProducerStamp,
    },
    suspendedAt:
      agreement.data.suspendedAt ?? utcToZonedTime(new Date(), "Etc/UTC"),
  };

  const updatedAgreement: Agreement = {
    ...agreement.data,
    ...updateSeed,
  };

  return toCreateEventAgreementUpdated(
    updatedAgreement,
    agreement.metadata.version
  );
}

const suspendedByConsumerStamp = (
  agreement: Agreement,
  requesterOrgId: Tenant["id"],
  destinationState: AgreementState,
  stamp: AgreementStamp
): AgreementStamp | undefined =>
  match([requesterOrgId, destinationState])
    .with([agreement.consumerId, agreementState.suspended], () => stamp)
    .with([agreement.consumerId, P.any], () => undefined)
    .otherwise(() => agreement.stamps.suspensionByConsumer);

const suspendedByProducerStamp = (
  agreement: Agreement,
  requesterOrgId: Tenant["id"],
  destinationState: AgreementState,
  stamp: AgreementStamp
): AgreementStamp | undefined =>
  match([requesterOrgId, destinationState])
    .with([agreement.producerId, agreementState.suspended], () => stamp)
    .with([agreement.producerId, P.any], () => undefined)
    .otherwise(() => agreement.stamps.suspensionByProducer);
