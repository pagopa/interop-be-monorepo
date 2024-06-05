/* eslint-disable max-params */
import { AuthData, CreateEvent } from "pagopa-interop-commons";
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
import { apiAgreementDocumentToAgreementDocument } from "../model/domain/apiConverter.js";
import {
  agreementNotInExpectedState,
  consumerWithNotValidEmail,
} from "../model/domain/errors.js";
import { UpdateAgreementSeed } from "../model/domain/models.js";
import {
  matchingCertifiedAttributes,
  matchingDeclaredAttributes,
  matchingVerifiedAttributes,
} from "../model/domain/validators.js";
import { ApiAgreementSubmissionPayload } from "../model/types.js";
import { ContractBuilder } from "./agreementContractBuilder.js";
import { createStamp } from "./agreementStampUtils.js";

export type AgremeentSubmissionResults = {
  events: Array<CreateEvent<AgreementEvent>>;
  initAgreement: Agreement;
  version: number;
};

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
  payload: ApiAgreementSubmissionPayload,
  newState: AgreementState,
  userId: UserId,
  suspendedByPlatform: boolean | undefined
): UpdateAgreementSeed => {
  const stamps = calculateStamps(agreement, newState, createStamp(userId));
  const isActivation = newState === agreementState.active;

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

export const addContractOnFirstActivation = async (
  contractBuilder: ContractBuilder,
  eservice: EService,
  consumer: Tenant,
  producer: Tenant,
  updateSeed: UpdateAgreementSeed,
  authData: AuthData,
  agreement: Agreement,
  hasRelatedAgreements: boolean
): Promise<Agreement> => {
  const isFirstActivation =
    agreement.state === agreementState.active && !hasRelatedAgreements;

  if (isFirstActivation) {
    const contract = await contractBuilder.createContract(
      authData.selfcareId,
      agreement,
      eservice,
      consumer,
      producer,
      updateSeed
    );

    return {
      ...agreement,
      contract: apiAgreementDocumentToAgreementDocument(contract),
    };
  }

  return agreement;
};
