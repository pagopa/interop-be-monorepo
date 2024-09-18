import {
  agreementApi,
  apiGatewayApi,
  catalogApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import { operationForbidden, TenantId } from "pagopa-interop-models";
import {
  activeAgreementByEserviceAndConsumerNotFound,
  invalidAgreementState,
  missingActivePurposeVersion,
  multipleAgreementForEserviceAndConsumer,
} from "../models/errors.js";

export function assertAgreementStateNotDraft(
  agreementState: agreementApi.AgreementState,
  agreementId: agreementApi.Agreement["id"]
): asserts agreementState is apiGatewayApi.AgreementState {
  if (agreementState === agreementApi.AgreementState.Values.DRAFT) {
    throw invalidAgreementState(agreementState, agreementId);
  }
}

export function assertActivePurposeVersionExists(
  purposeVersion: purposeApi.PurposeVersion | undefined,
  purposeId: purposeApi.Purpose["id"]
): asserts purposeVersion is NonNullable<purposeApi.PurposeVersion> {
  if (!purposeVersion) {
    throw missingActivePurposeVersion(purposeId);
  }
}

export function assertIsEserviceProducer(
  eservice: catalogApi.EService,
  organizationId: TenantId
): void {
  if (eservice.producerId !== organizationId) {
    throw operationForbidden;
  }
}

export function assertOnlyOneAgreementForEserviceAndConsumerExists(
  agreements: apiGatewayApi.Agreement[],
  eserviceId: apiGatewayApi.Agreement["eserviceId"],
  consumerId: apiGatewayApi.Agreement["consumerId"]
): asserts agreements is [apiGatewayApi.Agreement] {
  if (agreements.length === 0) {
    throw activeAgreementByEserviceAndConsumerNotFound(eserviceId, consumerId);
  } else if (agreements.length > 1) {
    throw multipleAgreementForEserviceAndConsumer(eserviceId, consumerId);
  }
}
