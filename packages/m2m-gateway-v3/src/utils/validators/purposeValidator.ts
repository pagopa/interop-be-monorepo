import { purposeApi } from "pagopa-interop-api-clients";
import {
  missingPurposeVersionWithState,
  missingPurposeCurrentVersion,
} from "../../model/errors.js";

export function assertPurposeVersionExistsWithState(
  purposeVersion: purposeApi.PurposeVersion | undefined,
  purposeId: purposeApi.Purpose["id"],
  state: purposeApi.PurposeVersionState
): asserts purposeVersion is NonNullable<purposeApi.PurposeVersion> {
  if (!purposeVersion) {
    throw missingPurposeVersionWithState(purposeId, state);
  }
}

export function assertPurposeCurrentVersionExists(
  purposeVersion: purposeApi.PurposeVersion | undefined,
  purposeId: purposeApi.Purpose["id"]
): asserts purposeVersion is NonNullable<purposeApi.PurposeVersion> {
  if (!purposeVersion) {
    throw missingPurposeCurrentVersion(purposeId);
  }
}
