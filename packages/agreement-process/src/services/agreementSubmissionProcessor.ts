/* eslint-disable max-params */
import { utcToZonedTime } from "date-fns-tz";
import { CreateEvent, getContext, logger } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEvent,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
  Descriptor,
  EService,
  Tenant,
  UpdateAgreementSeed,
  WithMetadata,
  agreementAttributeType,
  agreementState,
  tenantMailKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  consumerWithNotValidEmail,
  eServiceNotFound,
  tenantIdNotFound,
} from "../model/domain/errors.js";
import { toCreateEventAgreementUpdated } from "../model/domain/toEvent.js";
import {
  assertRequesterIsConsumer,
  assertSubmittableState,
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
  validateActiveOrPendingAgreement,
  validateSubmitOnDescriptor,
  verifySubmissionConflictingAgreements,
} from "../model/domain/validators.js";
import { ApiAgreementSubmissionPayload } from "../model/types.js";
import { agreementStateByFlags, nextState } from "./ageementStateProcessor.js";
import {
  ContractBuilder,
  addAgreementContractLogic,
} from "./agreementContractBuilder.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";

export type AgremeentSubmissionResults = {
  events: Array<CreateEvent<AgreementEvent>>;
  initAgreement: Agreement;
  version: number;
};

export async function submitAgreementLogic(
  agreementId: string,
  payload: ApiAgreementSubmissionPayload,
  constractBuilder: ContractBuilder,
  eserviceQuery: EserviceQuery,
  agreementQuery: AgreementQuery,
  tenantQuery: TenantQuery
): Promise<Array<CreateEvent<AgreementEvent>>> {
  logger.info(`Submitting agreement ${agreementId}`);
  const {
    authData: { organizationId },
  } = getContext();

  const agreement = await agreementQuery.getAgreementById(agreementId);

  if (!agreement) {
    throw agreementNotFound(agreementId);
  }

  assertRequesterIsConsumer(organizationId, agreement.data.consumerId);
  assertSubmittableState(agreement.data.state, agreement.data.id);
  await verifySubmissionConflictingAgreements(agreement.data, agreementQuery);

  const eservice = (
    await eserviceQuery.getEServiceById(agreement.data.eserviceId)
  )?.data;
  if (!eservice) {
    throw eServiceNotFound(agreement.data.eserviceId);
  }

  const descriptor = await validateSubmitOnDescriptor(
    eservice,
    agreement.data.descriptorId
  );

  const consumer = (await tenantQuery.getTenantById(agreement.data.consumerId))
    ?.data;

  if (!consumer) {
    throw tenantIdNotFound(agreement.data.consumerId);
  }

  return await submitAgreement(
    agreement,
    eservice,
    descriptor,
    consumer,
    payload,
    agreementQuery,
    tenantQuery,
    constractBuilder
  );
}

const submitAgreement = async (
  agreementData: WithMetadata<Agreement>,
  eService: EService,
  descriptor: Descriptor,
  consumer: Tenant,
  payload: ApiAgreementSubmissionPayload,
  agreementQuery: AgreementQuery,
  tenantQuery: TenantQuery,
  constractBuilder: ContractBuilder
): Promise<Array<CreateEvent<AgreementEvent>>> => {
  const agreement = agreementData.data;
  const { authData } = getContext();
  const nextStateByAttributes = nextState(agreement, descriptor, consumer);
  const suspendedByPlatform = suspendedByPlatformFlag(nextStateByAttributes);

  const newState = agreementStateByFlags(
    nextStateByAttributes,
    undefined,
    undefined,
    suspendedByPlatform
  );

  if (agreement.state === agreementState.draft) {
    await validateConsumerEmail(agreement, tenantQuery);
  }
  const stamp: AgreementStamp = {
    who: authData.userId,
    when: utcToZonedTime(new Date(), "Etc/UTC"),
  };
  const stamps = calculateStamps(agreement, newState, stamp);
  const updateSeed = getUpdateSeed(
    descriptor,
    consumer,
    eService,
    agreement,
    payload,
    stamps,
    newState,
    suspendedByPlatform
  );

  const updatedAgreement = {
    ...agreement,
    ...updateSeed,
  };

  const updatedAgreementEvent = toCreateEventAgreementUpdated(
    updatedAgreement,
    agreementData.metadata.version
  );

  const agreements = (
    await agreementQuery.getAllAgreements({
      producerId: agreement.producerId,
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      agreementStates: [agreementState.active, agreementState.suspended],
    })
  ).filter((a: WithMetadata<Agreement>) => a.data.id !== agreement.id);

  const archivedAgreementsUpdates: Array<CreateEvent<AgreementEvent>> =
    isActiveOrSuspended(newState)
      ? await Promise.all(
          agreements.map(
            async (
              agreement: WithMetadata<Agreement>
            ): Promise<CreateEvent<AgreementEvent>> => {
              const updateSeed: UpdateAgreementSeed = {
                state: agreementState.archived,
                certifiedAttributes: agreement.data.certifiedAttributes.map(
                  (ca) => ({
                    type: agreementAttributeType.CERTIFIED,
                    id: ca.id,
                  })
                ),
                declaredAttributes: agreement.data.declaredAttributes.map(
                  (da) => ({
                    type: agreementAttributeType.DECLARED,
                    id: da.id,
                  })
                ),
                verifiedAttributes: agreement.data.verifiedAttributes.map(
                  (va) => ({
                    type: agreementAttributeType.VERIFIED,
                    id: va.id,
                  })
                ),
                stamps: {
                  ...agreement.data.stamps,
                  archiving: {
                    who: authData.userId,
                    when: utcToZonedTime(new Date(), "Etc/UTC"),
                  },
                },
              };

              return toCreateEventAgreementUpdated(
                {
                  ...agreement.data,
                  ...updateSeed,
                },
                agreement.metadata.version
              );
            }
          )
        )
      : [];

  validateActiveOrPendingAgreement(agreement.id, newState);

  /* 
    NOTE (@Viktor-K)
    The 'createContractEvents' array contains events related to contract creation or updates to the same agreement (identified by the same stream ID) 
    as the previous events collected in 'updatedAgreementEvent.'
    To ensure proper event versioning progression, we need to manually increment the version by '+1.' 
    This incrementation should reflect the next expected version at the moment when the 'create-contract-event' was processed, not when it was initially created."
    */
  const createContractEvents: Array<CreateEvent<AgreementEvent>> =
    updatedAgreement.state === agreementState.active && agreements.length === 0
      ? [
          await createContract(
            updatedAgreement,
            updatedAgreementEvent.version + 1,
            eService,
            consumer,
            updateSeed,
            tenantQuery,
            constractBuilder
          ),
        ]
      : [];

  return [
    updatedAgreementEvent,
    ...archivedAgreementsUpdates,
    ...createContractEvents,
  ];
};

const createContract = async (
  agreement: Agreement,
  agreementVersionNumer: number,
  eservice: EService,
  consumer: Tenant,
  seed: UpdateAgreementSeed,
  tenantQuery: TenantQuery,
  constractBuilder: ContractBuilder
): Promise<CreateEvent<AgreementEvent>> => {
  const producer = await tenantQuery.getTenantById(agreement.producerId);

  if (!producer?.data) {
    throw tenantIdNotFound(agreement.producerId);
  }

  const agreementdocumentSeed = {
    ...(await constractBuilder.createContract(
      agreement,
      eservice,
      consumer,
      producer.data,
      seed
    )),
    createdAt: utcToZonedTime(new Date(), "Etc/UTC"),
  };

  return addAgreementContractLogic(
    agreement.id,
    agreementdocumentSeed,
    agreementVersionNumer
  );
};

const validateConsumerEmail = async (
  agreement: Agreement,
  tenantQuery: TenantQuery
): Promise<void> => {
  const consumer = await tenantQuery.getTenantById(agreement.consumerId);

  if (
    !consumer?.data.mails.find(
      (mail) => mail.kind === tenantMailKind.ContactEmail
    )
  ) {
    throw consumerWithNotValidEmail(agreement.id, agreement.consumerId);
  }
};

const getUpdateSeed = (
  descriptor: Descriptor,
  consumer: Tenant,
  eService: EService,
  agreement: Agreement,
  payload: ApiAgreementSubmissionPayload,
  stamps: AgreementStamps,
  newState: AgreementState,
  suspendedByPlatform: boolean
): UpdateAgreementSeed =>
  newState === agreementState.active
    ? {
        state: newState,
        certifiedAttributes: matchingCertifiedAttributes(descriptor, consumer),
        declaredAttributes: matchingDeclaredAttributes(descriptor, consumer),
        verifiedAttributes: matchingVerifiedAttributes(
          eService,
          descriptor,
          consumer
        ),
        suspendedByConsumer: agreement.suspendedByConsumer,
        suspendedByProducer: agreement.suspendedByProducer,
        suspendedByPlatform,
        consumerNotes: payload.consumerNotes,
        stamps,
      }
    : {
        state: newState,
        certifiedAttributes: [],
        declaredAttributes: [],
        verifiedAttributes: [],
        suspendedByConsumer: undefined,
        suspendedByProducer: undefined,
        suspendedByPlatform,
        consumerNotes: payload.consumerNotes,
        stamps,
      };

const suspendedByPlatformFlag = (fsmState: AgreementState): boolean =>
  fsmState === agreementState.suspended ||
  fsmState === agreementState.missingCertifiedAttributes;

const isActiveOrSuspended = (state: AgreementState): boolean =>
  state === agreementState.active || state === agreementState.suspended;

const calculateStamps = (
  agreement: Agreement,
  state: AgreementState,
  stamp: AgreementStamp
): AgreementStamps =>
  match<AgreementState, AgreementStamps>(state)
    .with(agreementState.draft, () => agreement.stamps)
    .with(agreementState.pending, () => ({
      ...agreement.stamps,
      submission: stamp,
    }))
    .with(agreementState.active, () => ({
      ...agreement.stamps,
      submission: stamp,
      activation: stamp,
    }))
    .with(agreementState.missingCertifiedAttributes, () => agreement.stamps)
    .otherwise(() => {
      throw agreementNotInExpectedState(agreement.id, state);
    });
