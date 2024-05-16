/* eslint-disable max-params */
import { CreateEvent } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementEvent,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
  Descriptor,
  EService,
  SelfcareId,
  Tenant,
  UserId,
  agreementState,
  tenantMailKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  agreementNotInExpectedState,
  consumerWithNotValidEmail,
} from "../model/domain/errors.js";
import {
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
} from "../model/domain/validators.js";
import { ApiAgreementSubmissionPayload } from "../model/types.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import { retrieveTenant } from "./agreementService.js";
import { createStamp } from "./agreementStampUtils.js";
import { ReadModelService } from "./readModelService.js";

export type AgremeentSubmissionResults = {
  events: Array<CreateEvent<AgreementEvent>>;
  initAgreement: Agreement;
  version: number;
};

export async function submitAgreementLogic(
  agreementId: AgreementId,
  payload: ApiAgreementSubmissionPayload,
  constractBuilder: ContractBuilder,
  eserviceQuery: EserviceQuery,
  agreementQuery: AgreementQuery,
  tenantQuery: TenantQuery,
  ctx: WithLogger<AppContext>
): Promise<[Agreement, Array<CreateEvent<AgreementEvent>>]> {
  const logger = ctx.logger;
  logger.info(`Submitting agreement ${agreementId}`);

  const agreement = await agreementQuery.getAgreementById(agreementId);

  if (!agreement) {
    throw agreementNotFound(agreementId);
  }

  assertRequesterIsConsumer(agreement.data, ctx.authData);
  assertSubmittableState(agreement.data.state, agreement.data.id);
  await verifySubmissionConflictingAgreements(agreement.data, agreementQuery);

  const eservice = await eserviceQuery.getEServiceById(
    agreement.data.eserviceId
  );
  if (!eservice) {
    throw eServiceNotFound(agreement.data.eserviceId);
  }

  const descriptor = await validateSubmitOnDescriptor(
    eservice,
    agreement.data.descriptorId
  );

  const consumer = await tenantQuery.getTenantById(agreement.data.consumerId);

  if (!consumer) {
    throw tenantNotFound(agreement.data.consumerId);
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
    ctx
  );
}

const submitAgreement = async (
  agreementData: WithMetadata<Agreement>,
  eservice: EService,
  descriptor: Descriptor,
  consumer: Tenant,
  payload: ApiAgreementSubmissionPayload,
  agreementQuery: AgreementQuery,
  tenantQuery: TenantQuery,
  constractBuilder: ContractBuilder,
  { authData, correlationId }: WithLogger<AppContext>
): Promise<[Agreement, Array<CreateEvent<AgreementEvent>>]> => {
  const agreement = agreementData.data;
  const nextStateByAttributes = nextState(agreement, descriptor, consumer);

  const newState = agreementStateByFlags(
    nextStateByAttributes,
    undefined,
    undefined
  );

  if (agreement.state === agreementState.draft) {
    await validateConsumerEmail(agreement, tenantQuery);
  }
  const stamp = createStamp(authData);
  const stamps = calculateStamps(agreement, newState, stamp);
  const updateSeed = getUpdateSeed(
    descriptor,
    consumer,
    eservice,
    agreement,
    payload,
    stamps,
    newState,
    false
  );

  const agreements = (
    await agreementQuery.getAllAgreements({
      producerId: agreement.producerId,
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      agreementStates: [agreementState.active, agreementState.suspended],
    })
  ).filter((a: WithMetadata<Agreement>) => a.data.id !== agreement.id);

  const newAgreement = {
    ...agreement,
    ...updateSeed,
  };

  const submittedAgreement =
    newAgreement.state === agreementState.active && agreements.length === 0
      ? {
          ...newAgreement,
          contract: await createContract(
            authData.selfcareId,
            newAgreement,
            eservice,
            consumer,
            updateSeed,
            tenantQuery,
            constractBuilder
          ),
        }
      : newAgreement;

  const submittedAgreementEvent = toCreateEventAgreementSubmitted(
    submittedAgreement,
    agreementData.metadata.version,
    correlationId
  );

  const archivedAgreementsUpdates: Array<CreateEvent<AgreementEvent>> =
    isActiveOrSuspended(newState)
      ? await Promise.all(
          agreements.map(
            async (
              agreement: WithMetadata<Agreement>
            ): Promise<CreateEvent<AgreementEvent>> => {
              const updateSeed: UpdateAgreementSeed = {
                state: agreementState.archived,
                stamps: {
                  ...agreement.data.stamps,
                  archiving: createStamp(authData),
                },
              };

              return toCreateEventAgreementArchivedByUpgrade(
                {
                  ...agreement.data,
                  ...updateSeed,
                },
                agreement.metadata.version,
                correlationId
              );
            }
          )
        )
      : [];

  validateActiveOrPendingAgreement(agreement.id, newState);

  return [
    submittedAgreement,
    [submittedAgreementEvent, ...archivedAgreementsUpdates],
  ];
};

const createContract = async (
  selfcareId: SelfcareId,
  agreement: Agreement,
  eservice: EService,
  consumer: Tenant,
  seed: UpdateAgreementSeed,
  tenantQuery: TenantQuery,
  constractBuilder: ContractBuilder
): Promise<AgreementDocument> => {
  const producer = await tenantQuery.getTenantById(agreement.producerId);

  if (!producer) {
    throw tenantNotFound(agreement.producerId);
  }

  if (agreement.contract) {
    throw contractAlreadyExists(agreement.id);
  }

  const newContract = await constractBuilder.createContract(
    selfcareId,
    agreement,
    eservice,
    consumer,
    producer,
    seed
  );
  const agreementdocumentSeed: AgreementDocument = {
    ...newContract,
    id: unsafeBrandId(newContract.id),
    createdAt: new Date(),
  };

  return agreementdocumentSeed;
};

const validateConsumerEmail = async (
  agreement: Agreement,
  tenantQuery: TenantQuery
): Promise<void> => {
  const consumer = await retrieveTenant(agreement.consumerId, readModelService);

  const hasContactEmail = consumer.mails.some(
    (mail) => mail.kind === tenantMailKind.ContactEmail
  );

  if (!hasContactEmail) {
    throw consumerWithNotValidEmail(agreement.id, agreement.consumerId);
  }
};

export const createSubmissionUpdateAgreementSeed = (
  descriptor: Descriptor,
  consumer: Tenant,
  eservice: EService,
  agreement: Agreement,
  payload: ApiAgreementSubmissionPayload,
  newState: AgreementState,
  suspendedByPlatform: boolean,
  userId: UserId
): UpdateAgreementSeed => {
  const stamps = calculateStamps(agreement, newState, createStamp(userId));

  return newState === agreementState.active
    ? {
        state: newState,
        certifiedAttributes: matchingCertifiedAttributes(descriptor, consumer),
        declaredAttributes: matchingDeclaredAttributes(descriptor, consumer),
        verifiedAttributes: matchingVerifiedAttributes(
          eservice,
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
};

export const isActiveOrSuspended = (state: AgreementState): boolean =>
  state === agreementState.active || state === agreementState.suspended;

export const calculateStamps = (
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
