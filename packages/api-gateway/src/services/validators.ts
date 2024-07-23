import {
  agreementApi,
  apiGatewayApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import {
  invalidAgreementState,
  missingActivePurposeVersion,
} from "../models/errors.js";

export function assertAgreementStateNotDraft(
  agreementState: agreementApi.AgreementState,
  agreementId: agreementApi.Agreement["id"]
): asserts agreementState is apiGatewayApi.AgreementState {
  if (agreementState === agreementApi.AgreementState.Values.DRAFT) {
    throw invalidAgreementState(agreementState, agreementId);
  }
}

export function assertActivePurposeVersionExixsts(
  purposeVersion: purposeApi.PurposeVersion | undefined,
  purposeId: purposeApi.Purpose["id"]
): asserts purposeVersion is NonNullable<purposeApi.PurposeVersion> {
  if (!purposeVersion) {
    throw missingActivePurposeVersion(purposeId);
  }
}
