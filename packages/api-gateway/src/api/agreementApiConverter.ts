import { agreementApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { Logger } from "pagopa-interop-commons";
import {
  AgreementDocument,
  Agreement,
  unsafeBrandId,
  AgreementState,
  agreementState,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { assertAgreementStateNotDraft } from "../services/validators.js";

const allowedAgreementStates: apiGatewayApi.AgreementState[] = [
  apiGatewayApi.AgreementState.Values.PENDING,
  apiGatewayApi.AgreementState.Values.ACTIVE,
  apiGatewayApi.AgreementState.Values.SUSPENDED,
  apiGatewayApi.AgreementState.Values.ARCHIVED,
  apiGatewayApi.AgreementState.Values.MISSING_CERTIFIED_ATTRIBUTES,
];

export function toApiGatewayAgreementIfNotDraft(
  agreement: agreementApi.Agreement,
  logger: Logger
): apiGatewayApi.Agreement {
  assertAgreementStateNotDraft(agreement.state, agreement.id, logger);

  return {
    id: agreement.id,
    eserviceId: agreement.eserviceId,
    descriptorId: agreement.descriptorId,
    producerId: agreement.producerId,
    consumerId: agreement.consumerId,
    state: agreement.state,
  };
}

export function toAgreementProcessGetAgreementsQueryParams(
  queryParams: apiGatewayApi.GetAgreementsQueryParams
): Omit<agreementApi.GetAgreementsQueryParams, "offset" | "limit"> {
  const { producerId, consumerId, eserviceId, descriptorId, states } =
    queryParams;

  return {
    producersIds: producerId ? [producerId] : [],
    consumersIds: consumerId ? [consumerId] : [],
    eservicesIds: eserviceId ? [eserviceId] : [],
    descriptorsIds: descriptorId ? [descriptorId] : [],
    showOnlyUpgradeable: false,
    states: states && states.length > 0 ? states : allowedAgreementStates,
  };
}

export function agreementStateToApiAgreementState(
  input: AgreementState
): agreementApi.AgreementState {
  return match<AgreementState, agreementApi.AgreementState>(input)
    .with(agreementState.pending, () => "PENDING")
    .with(agreementState.rejected, () => "REJECTED")
    .with(agreementState.active, () => "ACTIVE")
    .with(agreementState.suspended, () => "SUSPENDED")
    .with(agreementState.archived, () => "ARCHIVED")
    .with(agreementState.draft, () => "DRAFT")
    .with(
      agreementState.missingCertifiedAttributes,
      () => "MISSING_CERTIFIED_ATTRIBUTES"
    )
    .exhaustive();
}

export const agreementDocumentToApiAgreementDocument = (
  input: AgreementDocument
): agreementApi.Document => ({
  id: input.id,
  name: input.name,
  prettyName: input.prettyName,
  contentType: input.contentType,
  path: input.path,
  createdAt: input.createdAt?.toJSON(),
});

export const agreementToApiAgreement = (
  agreement: Agreement
): agreementApi.Agreement => ({
  id: agreement.id,
  eserviceId: agreement.eserviceId,
  descriptorId: agreement.descriptorId,
  producerId: agreement.producerId,
  consumerId: agreement.consumerId,
  state: agreementStateToApiAgreementState(agreement.state),
  verifiedAttributes: agreement.verifiedAttributes,
  certifiedAttributes: agreement.certifiedAttributes,
  declaredAttributes: agreement.declaredAttributes,
  suspendedByConsumer: agreement.suspendedByConsumer,
  suspendedByProducer: agreement.suspendedByProducer,
  suspendedByPlatform: agreement.suspendedByPlatform,
  consumerNotes: agreement.consumerNotes,
  rejectionReason: agreement.rejectionReason,
  consumerDocuments: agreement.consumerDocuments.map(
    agreementDocumentToApiAgreementDocument
  ),
  createdAt: agreement.createdAt?.toJSON(),
  updatedAt: agreement.updatedAt?.toJSON(),
  contract: agreement.contract
    ? agreementDocumentToApiAgreementDocument(agreement.contract)
    : undefined,
  suspendedAt: agreement.suspendedAt?.toJSON(),
});

export const apiAgreementDocumentToAgreementDocument = (
  input: agreementApi.DocumentSeed
): AgreementDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: new Date(),
});
