import { AuthData, CreateEvent } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEvent,
  agreementState,
} from "pagopa-interop-models";
import {
  assertAgreementExist,
  assertEServiceExist,
  assertExpectedState,
  assertRequesterIsConsumerOrProducer,
  assertTenantExist,
  assertDescriptorExist,
  agreementSuspendableStates,
} from "../model/domain/validators.js";
import { toCreateEventAgreementUpdated } from "../model/domain/toEvent.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
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
import {
  createStamp,
  suspendedByConsumerStamp,
  suspendedByProducerStamp,
} from "./agreementStampUtils.js";

export async function suspendAgreementLogic({
  agreementId,
  authData,
  agreementQuery,
  tenantQuery,
  eserviceQuery,
  correlationId,
}: {
  agreementId: Agreement["id"];
  authData: AuthData;
  agreementQuery: AgreementQuery;
  tenantQuery: TenantQuery;
  eserviceQuery: EserviceQuery;
  correlationId: string;
}): Promise<CreateEvent<AgreementEvent>> {
  const agreement = await agreementQuery.getAgreementById(agreementId);
  assertAgreementExist(agreementId, agreement);

  assertRequesterIsConsumerOrProducer(agreement.data, authData);

  assertExpectedState(
    agreementId,
    agreement.data.state,
    agreementSuspendableStates
  );

  const eservice = await eserviceQuery.getEServiceById(
    agreement.data.eserviceId
  );
  assertEServiceExist(agreement.data.eserviceId, eservice);

  const consumer = await tenantQuery.getTenantById(agreement.data.consumerId);
  assertTenantExist(agreement.data.consumerId, consumer);

  const descriptor = eservice.data.descriptors.find(
    (d) => d.id === agreement.data.descriptorId
  );
  assertDescriptorExist(
    eservice.data.id,
    agreement.data.descriptorId,
    descriptor
  );

  const nextStateByAttributes = nextState(
    agreement.data,
    descriptor,
    consumer.data
  );

  const suspendedByConsumer = suspendedByConsumerFlag(
    agreement.data,
    authData.organizationId,
    agreementState.suspended
  );
  const suspendedByProducer = suspendedByProducerFlag(
    agreement.data,
    authData.organizationId,
    agreementState.suspended
  );
  const suspendedByPlatform = suspendedByPlatformFlag(nextStateByAttributes);
  const newState = agreementStateByFlags(
    nextStateByAttributes,
    suspendedByProducer,
    suspendedByConsumer,
    suspendedByPlatform
  );

  const stamp = createStamp(authData);

  const suspensionByProducerStamp = suspendedByProducerStamp(
    agreement.data,
    authData.organizationId,
    agreementState.suspended,
    stamp
  );

  const suspensionByConsumerStamp = suspendedByConsumerStamp(
    agreement.data,
    authData.organizationId,
    agreementState.suspended,
    stamp
  );

  const updateSeed: UpdateAgreementSeed = {
    state: newState,
    suspendedByConsumer,
    suspendedByProducer,
    suspendedByPlatform,
    stamps: {
      ...agreement.data.stamps,
      suspensionByConsumer: suspensionByConsumerStamp,
      suspensionByProducer: suspensionByProducerStamp,
    },
    suspendedAt: agreement.data.suspendedAt ?? new Date(),
  };

  const updatedAgreement: Agreement = {
    ...agreement.data,
    ...updateSeed,
  };

  return toCreateEventAgreementUpdated(
    updatedAgreement,
    agreement.metadata.version,
    correlationId
  );
}
