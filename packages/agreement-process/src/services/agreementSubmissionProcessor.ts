/* eslint-disable max-params */
import { utcToZonedTime } from "date-fns-tz";
import { CreateEvent, getContext, logger } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
  AgreementUpdateEvent,
  Descriptor,
  EService,
  Tenant,
  UpdateAgreementSeed,
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
  validateSubmitOnDescriptor,
  verifySubmissionConflictingAgreements,
} from "../model/domain/validators.js";
import {
  ApiAgreementDocumentSeed,
  ApiAgreementSubmissionPayload,
} from "../model/types.js";
import { agreementStateByFlags, nextState } from "./ageementStateProcessor.js";
import { ContractBuilder } from "./agreementContractBuilder.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";
import { EserviceQuery } from "./readmodel/eserviceQuery.js";
import { TenantQuery } from "./readmodel/tenantQuery.js";

export type AgremeentSubmissionResults = {
  events: Array<CreateEvent<AgreementUpdateEvent>>;
  updatedAgreement: Agreement;
};
export type AgremeentSubmissionResult = {
  event: CreateEvent<AgreementUpdateEvent>;
  updatedAgreement: Agreement;
};

export async function submitAgreementLogic(
  agreementId: string,
  payload: ApiAgreementSubmissionPayload,
  constractBuilder: ContractBuilder,
  eserviceQuery: EserviceQuery,
  agreementQuery: AgreementQuery,
  tenantQuery: TenantQuery,
  addContract: (
    agreementId: string,
    seed: ApiAgreementDocumentSeed
  ) => Promise<void>
): Promise<AgremeentSubmissionResults> {
  logger.info(`Submitting agreement ${agreementId}`);
  const {
    authData: { organizationId },
  } = getContext();

  const agreement = (await agreementQuery.getAgreementById(agreementId))?.data;

  if (!agreement) {
    throw agreementNotFound(agreementId);
  }

  assertRequesterIsConsumer(organizationId, agreement.consumerId);
  assertSubmittableState(agreement.state, agreement.id);
  await verifySubmissionConflictingAgreements(agreement, agreementQuery);

  const eservice = (await eserviceQuery.getEServiceById(agreement.eserviceId))
    ?.data;
  if (!eservice) {
    throw eServiceNotFound(500, agreement.eserviceId);
  }

  const descriptor = await validateSubmitOnDescriptor(
    eservice,
    agreement.descriptorId
  );

  const consumer = (await tenantQuery.getTenantById(agreement.consumerId))
    ?.data;

  if (!consumer) {
    throw tenantIdNotFound(500, agreement.consumerId);
  }

  return await submitAgreement(
    agreement,
    eservice,
    descriptor,
    consumer,
    payload,
    agreementQuery,
    tenantQuery,
    constractBuilder,
    addContract
  );
}

const submitAgreement = async (
  agreement: Agreement,
  eService: EService,
  descriptor: Descriptor,
  consumer: Tenant,
  payload: ApiAgreementSubmissionPayload,
  agreementQuery: AgreementQuery,
  tenantQuery: TenantQuery,
  constractBuilder: ContractBuilder,
  addContract: (
    agreementId: string,
    seed: ApiAgreementDocumentSeed
  ) => Promise<void>
): Promise<AgremeentSubmissionResults> => {
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

  const updatedAgreementResult = await updateAgreementWithSeed(
    agreement.id,
    updateSeed,
    agreementQuery
  );
  const updatedAgreement = updatedAgreementResult.updatedAgreement;

  const agreements = (
    await agreementQuery.getAgreements({
      producerId: agreement.producerId,
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      agreementStates: [agreementState.active, agreementState.suspended],
    })
  ).filter((a: Agreement) => a.id !== agreement.id);

  const agremeentUpdateEvents: Array<CreateEvent<AgreementUpdateEvent>> =
    isActiveOrSuspended(newState)
      ? await Promise.all(
          agreements.map(async (a: Agreement) => {
            const updateSeed: UpdateAgreementSeed = {
              state: agreementState.archived,
              certifiedAttributes: a.certifiedAttributes.map((ca) => ({
                type: agreementAttributeType.CERTIFIED,
                id: ca.id,
              })),
              declaredAttributes: a.declaredAttributes.map((da) => ({
                type: agreementAttributeType.DECLARED,
                id: da.id,
              })),
              verifiedAttributes: a.verifiedAttributes.map((va) => ({
                type: agreementAttributeType.VERIFIED,
                id: va.id,
              })),
              stamps: {
                ...a.stamps,
                archiving: {
                  who: authData.userId,
                  when: utcToZonedTime(new Date(), "Etc/UTC"),
                },
              },
            };

            return (
              await updateAgreementWithSeed(
                agreement.id,
                updateSeed,
                agreementQuery
              )
            ).event;
          })
        )
      : [];

  if (
    updatedAgreement.state === agreementState.active &&
    agreements.length === 0
  ) {
    await createContract(
      updatedAgreement,
      eService,
      consumer,
      updateSeed,
      tenantQuery,
      constractBuilder,
      addContract
    );
  }

  return {
    events: [updatedAgreementResult.event, ...agremeentUpdateEvents],
    updatedAgreement,
  };
};

const createContract = async (
  agreement: Agreement,
  eservice: EService,
  consumer: Tenant,
  seed: UpdateAgreementSeed,
  tenantQuery: TenantQuery,
  constractBuilder: ContractBuilder,
  addContract: (
    agreementId: string,
    seed: ApiAgreementDocumentSeed
  ) => Promise<void>
): Promise<void> => {
  const producer = await tenantQuery.getTenantById(agreement.consumerId);

  if (!producer?.data) {
    throw tenantIdNotFound(500, agreement.consumerId);
  }

  const agreementdocumentSeed = await constractBuilder.createContract(
    agreement,
    eservice,
    consumer,
    producer.data,
    seed
  );

  await addContract(agreement.id, agreementdocumentSeed);
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

const updateAgreementWithSeed = async (
  agreementId: string,
  agreement: UpdateAgreementSeed,
  agreementQuery: AgreementQuery
): Promise<AgremeentSubmissionResult> => {
  const previousAgreement = await agreementQuery.getAgreementById(agreementId);

  if (!previousAgreement) {
    throw agreementNotFound(agreementId);
  }

  const updatedAgreement = {
    ...previousAgreement.data,
    ...agreement,
  };

  return {
    event: toCreateEventAgreementUpdated(
      updatedAgreement
    ) as CreateEvent<AgreementUpdateEvent>,
    updatedAgreement,
  };
};
