/* eslint-disable max-params */
import { UIAuthData, M2MAdminAuthData } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementStamp,
  AgreementStamps,
  AgreementState,
  Delegation,
  Descriptor,
  EService,
  Tenant,
  agreementState,
  tenantMailKind,
} from "pagopa-interop-models";
import { agreementApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import {
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
} from "../model/domain/agreement-validators.js";
import {
  agreementNotInExpectedState,
  consumerWithNotValidEmail,
} from "../model/domain/errors.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import { createStamp } from "./agreementStampUtils.js";

export const validateConsumerEmail = async (
  consumer: Tenant,
  agreement: Agreement
): Promise<void> => {
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
  payload: agreementApi.AgreementSubmissionPayload,
  newState: AgreementState,
  authData: UIAuthData | M2MAdminAuthData,
  suspendedByPlatform: boolean | undefined,
  activeConsumerDelegation: Delegation | undefined
): UpdateAgreementSeed => {
  const stamps = calculateStamps(
    agreement,
    newState,
    createStamp(authData, {
      consumerDelegation: activeConsumerDelegation,
      producerDelegation: undefined,
    })
  );
  const isActivation = newState === agreementState.active;

  // On submission, clear suspension flags only when the agreement becomes ACTIVE
  return isActivation
    ? {
        state: newState,
        certifiedAttributes: matchingCertifiedAttributes(descriptor, consumer),
        declaredAttributes: matchingDeclaredAttributes(descriptor, consumer),
        verifiedAttributes: matchingVerifiedAttributes(
          eservice,
          descriptor,
          consumer
        ),
        suspendedByConsumer: undefined,
        suspendedByProducer: undefined,
        suspendedAt: undefined,
        suspendedByPlatform,
        consumerNotes: payload.consumerNotes,
        stamps,
      }
    : {
        state: newState,
        certifiedAttributes: [],
        declaredAttributes: [],
        verifiedAttributes: [],
        suspendedByConsumer: agreement.suspendedByConsumer,
        suspendedByProducer: agreement.suspendedByProducer,
        suspendedAt: agreement.suspendedAt,
        suspendedByPlatform,
        consumerNotes: payload.consumerNotes,
        stamps,
      };
};

export const isActiveOrSuspended = (state: AgreementState): boolean =>
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
    .with(agreementState.suspended, () => agreement.stamps)
    .otherwise(() => {
      throw agreementNotInExpectedState(agreement.id, state);
    });
