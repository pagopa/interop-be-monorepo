import { purposeApi } from "pagopa-interop-api-clients";
import { missingActivePurposeVersion } from "../../model/errors.js";

export function assertActivePurposeVersionExists(
  purposeVersion: purposeApi.PurposeVersion | undefined,
  purposeId: purposeApi.Purpose["id"]
): asserts purposeVersion is NonNullable<purposeApi.PurposeVersion> {
  if (!purposeVersion) {
    throw missingActivePurposeVersion(purposeId);
  }
}
