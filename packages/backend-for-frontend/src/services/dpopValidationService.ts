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
  "dpopValidation"
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
      (error: ApiError<string>) => !isDPoPMatchError(error.code)
    );
    const dpopMatchErrors = validationResult.errors.filter(
      (error: ApiError<string>) => isDPoPMatchError(error.code)
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
  const dpopValidationErrors = [
    ...dpopProofErrors,
    ...dpopMatchErrors,
    ...dpopSignatureErrors,
  ];

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

function isDPoPMatchError(code: string): boolean {
  return (
    code === "dpopHtuNotFound" ||
    code === "invalidDPoPHtu" ||
    code === "dpopHtmNotFound" ||
    code === "invalidDPoPHtm"
  );
}
