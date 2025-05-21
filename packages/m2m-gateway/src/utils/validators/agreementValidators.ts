import { agreementApi } from "pagopa-interop-api-clients";
import { agreementNotInPendingState } from "../../model/errors.js";

export function assertAgreementIsPending(
  agreement: agreementApi.Agreement
): void {
  if (agreement.state !== agreementApi.AgreementState.Values.PENDING) {
    throw agreementNotInPendingState(agreement.id);
  }
}
