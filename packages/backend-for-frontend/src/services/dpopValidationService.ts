import { WithLogger } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { ApiError, featureFlagNotEnabled } from "pagopa-interop-models";
import {
  verifyDPoPProof,
  verifyDPoPProofSignature,
} from "pagopa-interop-dpop-validation";
import { config, type BffProcessConfig } from "../config/config.js";
import { BffAppContext } from "../utilities/context.js";

export type DPoPValidationSteps = Pick<
  bffApi.TokenGenerationValidationSteps,
  "dpopValidation"
>;

export async function validateDPoPProofForTokenGeneration(
  dpopProofJWS: string | undefined,
  ctx: WithLogger<BffAppContext>
): Promise<DPoPValidationSteps | undefined> {
  if (!dpopProofJWS) {
    return undefined;
  }

  assertDpopClientAssertionDebuggerConfig(config);

  ctx.logger.info("Validating DPoP proof for token generation debug tool");

  const validationResult = verifyDPoPProof({
    dpopProofJWS,
    expectedDPoPProofHtu: config.dpopHtuBase,
    expectedDPoPProofHtm: "POST",
    dpopProofIatToleranceSeconds: config.dpopIatToleranceSeconds,
    dpopProofDurationSeconds: config.dpopDurationSeconds,
  });

  if (validationResult.errors) {
    return toDPoPValidationSteps(validationResult.errors);
  }

  const { dpopProofJWT } = validationResult.data;

  const signatureResult = await verifyDPoPProofSignature(
    dpopProofJWS,
    dpopProofJWT.header.jwk
  );

  if (signatureResult.errors) {
    return toDPoPValidationSteps(signatureResult.errors);
  }

  return toDPoPValidationSteps();
}

type DPoPClientAssertionDebuggerConfig = BffProcessConfig & {
  featureFlagDpopClientAssertionDebugger: true;
  dpopHtuBase: string;
  dpopIatToleranceSeconds: number;
  dpopDurationSeconds: number;
};

function assertDpopClientAssertionDebuggerConfig(
  config: BffProcessConfig
): asserts config is DPoPClientAssertionDebuggerConfig {
  if (!config.featureFlagDpopClientAssertionDebugger) {
    throw featureFlagNotEnabled("featureFlagDpopClientAssertionDebugger");
  }
}

function toDPoPValidationSteps(
  dpopValidationErrors: Array<ApiError<string>> = []
): DPoPValidationSteps {
  return {
    dpopValidation: {
      result:
        dpopValidationErrors.length > 0
          ? bffApi.TokenGenerationValidationStepResult.Enum.FAILED
          : bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
      failures: apiErrorsToValidationFailures(dpopValidationErrors),
    },
  };
}

function apiErrorsToValidationFailures<T extends string>(
  errors: Array<ApiError<T>> | undefined
): bffApi.TokenGenerationValidationStepFailure[] {
  if (!errors) {
    return [];
  }

  return errors.map((err) => ({
    code: err.code,
    reason: err.message,
  }));
}
