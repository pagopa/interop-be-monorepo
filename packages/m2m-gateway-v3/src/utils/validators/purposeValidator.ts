import { m2mGatewayApiV3, purposeApi } from "pagopa-interop-api-clients";
import {
  missingPurposeVersionWithState,
  missingPurposeCurrentVersion,
  invalidSeedForPurposeFromTemplate,
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

export function assertSeedPatchPurposeUpdateFromTemplateContent(
  updateSeed:
    | m2mGatewayApiV3.PurposeDraftUpdateSeed
    | m2mGatewayApiV3.PurposeDraftFromTemplateUpdateSeed
): asserts updateSeed is m2mGatewayApiV3.PurposeDraftFromTemplateUpdateSeed {
  const result =
    m2mGatewayApiV3.PurposeDraftFromTemplateUpdateSeed.safeParse(updateSeed);
  if (!result.success) {
    throw invalidSeedForPurposeFromTemplate(
      result.error.issues.map((i) => i.message)
    );
  }
}
