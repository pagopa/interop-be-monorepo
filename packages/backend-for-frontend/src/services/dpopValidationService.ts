import { WithLogger } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { ApiError } from "pagopa-interop-models";
import {
  verifyDPoPProof,
  verifyDPoPProofSignature,
} from "pagopa-interop-dpop-validation";
import { config } from "../config/config.js";
import { BffAppContext } from "../utilities/context.js";

export type DPoPValidationSteps = Pick<
  bffApi.TokenGenerationValidationSteps,
  "dpopProofValidation" | "dpopMatchValidation" | "dpopSignatureVerification"
>;

export async function validateDPoPProofForTokenGeneration(
  dpopProofJWS: string | undefined,
  ctx: WithLogger<BffAppContext>
): Promise<DPoPValidationSteps | undefined> {
  if (!dpopProofJWS) {
    return undefined;
  }

  ctx.logger.info("Validating DPoP proof for token generation debug tool");

  const validationResult = verifyDPoPProof({
    dpopProofJWS,
    expectedDPoPProofHtu: config.dpopHtuBase,
    expectedDPoPProofHtm: "POST",
    dpopProofIatToleranceSeconds: config.dpopIatToleranceSeconds,
    dpopProofDurationSeconds: config.dpopDurationSeconds,
  });

  if (validationResult.errors) {
    const dpopProofErrors = validationResult.errors.filter(
      (error) => !isDPoPMatchError(error.code)
    );
    const dpopMatchErrors = validationResult.errors.filter((error) =>
      isDPoPMatchError(error.code)
    );

    return toDPoPValidationSteps({
      dpopProofErrors,
      dpopMatchErrors,
    });
  }

  const { dpopProofJWT } = validationResult.data;

  const signatureResult = await verifyDPoPProofSignature(
    dpopProofJWS,
    dpopProofJWT.header.jwk
  );

  if (signatureResult.errors) {
    return toDPoPValidationSteps({
      dpopSignatureErrors: signatureResult.errors,
    });
  }

  return toDPoPValidationSteps({});
}

function toDPoPValidationSteps(errs: {
  dpopProofErrors?: Array<ApiError<string>>;
  dpopMatchErrors?: Array<ApiError<string>>;
  dpopSignatureErrors?: Array<ApiError<string>>;
}): DPoPValidationSteps {
  const dpopProofErrors = errs.dpopProofErrors ?? [];
  const dpopMatchErrors = errs.dpopMatchErrors ?? [];
  const dpopSignatureErrors = errs.dpopSignatureErrors ?? [];

  return {
    dpopProofValidation: {
      result: getStepResult([], dpopProofErrors),
      failures: apiErrorsToValidationFailures(dpopProofErrors),
    },
    dpopMatchValidation: {
      result: getStepResult(dpopProofErrors, dpopMatchErrors),
      failures: apiErrorsToValidationFailures(dpopMatchErrors),
    },
    dpopSignatureVerification: {
      result: getStepResult(
        [...dpopProofErrors, ...dpopMatchErrors],
        dpopSignatureErrors
      ),
      failures: apiErrorsToValidationFailures(dpopSignatureErrors),
    },
  };
}

function getStepResult(
  prevStepErrors: Array<ApiError<string>>,
  currentStepErrors: Array<ApiError<string>>
): bffApi.TokenGenerationValidationStepResult {
  if (currentStepErrors.length > 0) {
    return bffApi.TokenGenerationValidationStepResult.Enum.FAILED;
  } else if (prevStepErrors.length > 0) {
    return bffApi.TokenGenerationValidationStepResult.Enum.SKIPPED;
  } else {
    return bffApi.TokenGenerationValidationStepResult.Enum.PASSED;
  }
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

function isDPoPMatchError(code: string): boolean {
  return (
    code === "dpopHtuNotFound" ||
    code === "invalidDPoPHtu" ||
    code === "dpopHtmNotFound" ||
    code === "invalidDPoPHtm"
  );
}
