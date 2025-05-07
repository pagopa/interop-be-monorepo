import { purposeApi } from "pagopa-interop-api-clients";
import { Logger } from "pagopa-interop-commons";
import { missingActivePurposeVersion } from "../model/errors.js";

export function assertActivePurposeVersionExists(
  purposeVersion: purposeApi.PurposeVersion | undefined,
  purposeId: purposeApi.Purpose["id"],
  logger: Logger
): asserts purposeVersion is NonNullable<purposeApi.PurposeVersion> {
  if (!purposeVersion) {
    throw missingActivePurposeVersion(purposeId, logger);
  }
}
