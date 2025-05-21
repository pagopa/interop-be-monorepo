import { purposeApi } from "pagopa-interop-api-clients";
import { missingActivePurposeVersionWithState } from "../../model/errors.js";

export function assertPurposeVersionExistsWithState(
  purposeVersion: purposeApi.PurposeVersion | undefined,
  purposeId: purposeApi.Purpose["id"],
  state: purposeApi.PurposeVersionState
): asserts purposeVersion is NonNullable<purposeApi.PurposeVersion> {
  if (!purposeVersion) {
    throw missingActivePurposeVersionWithState(purposeId, state);
  }
}
