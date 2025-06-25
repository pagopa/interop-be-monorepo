import { agreementApi, purposeApi } from "pagopa-interop-api-clients";
import {
  missingPurposeVersionWithState,
  missingPurposeCurrentVersion,
  purposeAgreementNotFound,
  multipleActiveAgreementForEserviceAndConsumer,
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

export function assertOnlyOneAgreementForEserviceAndConsumerExists(
  agreements: agreementApi.Agreement[],
  purposeId: string,
  eserviceId: string,
  consumerId: string
): asserts agreements is [agreementApi.Agreement] {
  if (agreements.length === 0) {
    throw purposeAgreementNotFound(purposeId);
  } else if (agreements.length > 1) {
    throw multipleActiveAgreementForEserviceAndConsumer(eserviceId, consumerId);
  }
}
