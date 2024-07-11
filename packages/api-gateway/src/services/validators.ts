import { agreementApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { invalidAgreementState } from "../models/errors.js";

export function assertAgreementStateNotDraft(
  agreementState: agreementApi.AgreementState,
  agreementId: agreementApi.Agreement["id"]
): asserts agreementState is apiGatewayApi.AgreementState {
  if (agreementState === agreementApi.AgreementState.Values.DRAFT) {
    throw invalidAgreementState(agreementState, agreementId);
  }
}
