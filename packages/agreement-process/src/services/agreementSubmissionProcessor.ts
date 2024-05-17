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
import { TenantQuery } from "./readmodel/tenantQuery.js";
import { retrieveTenant } from "./agreementService.js";
import { createStamp } from "./agreementStampUtils.js";

export type AgremeentSubmissionResults = {
  events: Array<CreateEvent<AgreementEvent>>;
  initAgreement: Agreement;
  version: number;
};

export const validateConsumerEmail = async (
  agreement: Agreement,
  tenantQuery: TenantQuery
): Promise<void> => {
  const consumer = await retrieveTenant(agreement.consumerId, tenantQuery);

  if (
    !consumer.mails.find((mail) => mail.kind === tenantMailKind.ContactEmail)
  ) {
    throw consumerWithNotValidEmail(agreement.id, agreement.consumerId);
  }
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
