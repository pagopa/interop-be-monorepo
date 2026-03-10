import { match } from "ts-pattern";
import {
  clientKindTokenGenStates,
  ClientAssertion,
  ClientAssertionHeader,
  ClientAssertionPayload,
  ClientAssertionPayloadStrict,
  ClientAssertionHeaderStrict,
  TokenGenerationStatesGenericClient,
} from "pagopa-interop-models";
import * as jose from "jose";
import {
  JOSEError,
  JWSInvalid,
  JWSSignatureVerificationFailed,
  JWTClaimValidationFailed,
  JWTExpired,
  JWTInvalid,
} from "jose/errors";
import { createPublicKey, Logger } from "pagopa-interop-commons";
import {
  failedValidation,
  successfulValidation,
  EXPECTED_CLIENT_ASSERTION_TYPE,
  EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE,
  validateJti,
  validateAlgorithm,
  validateAudience,
  validateDigest,
  validateExp,
  validateIat,
  validateIss,
  validateKid,
  validatePurposeId,
  validateSub,
  validatePlatformState,
  ALLOWED_ALGORITHM,
} from "./utils.js";
import {
  Base64Encoded,
  ClientAssertionValidationRequest,
  ValidationResult,
} from "./types.js";
import {
  unexpectedClientAssertionSignatureVerificationError,
  invalidAssertionType,
  invalidClientAssertionFormat,
  invalidGrantType,
  jsonWebTokenError,
  notBeforeError,
  purposeIdNotProvided,
  tokenExpiredError,
  unexpectedClientAssertionPayload,
  invalidSignature,
  clientAssertionInvalidClaims,
  algorithmNotAllowed,
  clientAssertionSignatureVerificationError,
} from "./errors.js";

export const validateRequestParameters = (
  request: ClientAssertionValidationRequest
): ValidationResult<ClientAssertionValidationRequest> => {
  const assertionTypeError =
    request.client_assertion_type !== EXPECTED_CLIENT_ASSERTION_TYPE
      ? invalidAssertionType(request.client_assertion_type)
      : undefined;

  const grantTypeError =
    request.grant_type !== EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE
      ? invalidGrantType(request.grant_type)
      : undefined;

  if (!assertionTypeError && !grantTypeError) {
    return successfulValidation(request);
  }
  return failedValidation([assertionTypeError, grantTypeError]);
};

// eslint-disable-next-line complexity
export const verifyClientAssertion = (
  clientAssertionJws: string,
  clientId: string | undefined,
  expectedAudiences: string[],
  logger: Logger,
  // TODO: delete when FEATURE_FLAG_CLIENT_ASSERTION_STRICT_CLAIMS_VALIDATION is removed
  featureFlagClientAssertionStrictClaimsValidation: boolean = false
  // eslint-disable-next-line sonarjs/cognitive-complexity
): ValidationResult<ClientAssertion> => {
  try {
    const decodedPayload = jose.decodeJwt(clientAssertionJws);
    const decodedHeader = jose.decodeProtectedHeader(clientAssertionJws);

    const { errors: jtiErrors, data: validatedJti } = validateJti(
      decodedPayload.jti
    );
    const { errors: iatErrors, data: validatedIat } = validateIat(
      decodedPayload.iat
    );
    const { errors: expErrors, data: validatedExp } = validateExp(
      decodedPayload.exp
    );
    const { errors: issErrors, data: validatedIss } = validateIss(
      decodedPayload.iss
    );
    const { errors: subErrors, data: validatedSub } = validateSub(
      decodedPayload.sub,
      clientId
    );
    const { errors: purposeIdErrors, data: validatedPurposeId } =
      validatePurposeId(decodedPayload.purposeId);
    const { errors: kidErrors, data: validatedKid } = validateKid(
      decodedHeader.kid
    );
    const { errors: audErrors, data: validatedAud } = validateAudience(
      decodedPayload.aud,
      expectedAudiences
    );
    const { errors: algErrors, data: validatedAlg } = validateAlgorithm(
      decodedHeader.alg
    );
    const { errors: digestErrors, data: validatedDigest } = validateDigest(
      decodedPayload.digest
    );

    if (
      !jtiErrors &&
      !iatErrors &&
      !expErrors &&
      !issErrors &&
      !subErrors &&
      !purposeIdErrors &&
      !kidErrors &&
      !audErrors &&
      !algErrors &&
      !digestErrors
    ) {
      const headerParseResult = ClientAssertionHeader.safeParse(decodedHeader);
      const payloadParseResult =
        ClientAssertionPayload.safeParse(decodedPayload);
      const parsingErrors = [
        !headerParseResult.success
          ? clientAssertionInvalidClaims(
              headerParseResult.error.message,
              "header"
            )
          : undefined,
        !payloadParseResult.success
          ? clientAssertionInvalidClaims(
              payloadParseResult.error.message,
              "payload"
            )
          : undefined,
      ].filter(Boolean);
      if (parsingErrors.length > 0) {
        return failedValidation(parsingErrors);
      }

      const headerStrictParseResult =
        ClientAssertionHeaderStrict.safeParse(decodedHeader);
      if (!headerStrictParseResult.success) {
        logger.warn(
          `[CLIENTID=${validatedSub}] Invalid claims in client assertion header: ${JSON.stringify(
            JSON.parse(headerStrictParseResult.error.message)
          )}`
        );
      }

      const payloadStrictParseResult =
        ClientAssertionPayloadStrict.safeParse(decodedPayload);
      if (!payloadStrictParseResult.success) {
        logger.warn(
          `[CLIENTID=${validatedSub}] Invalid claims in client assertion payload: ${JSON.stringify(
            JSON.parse(payloadStrictParseResult.error.message)
          )}`
        );
      }

      const strictParsingErrors = [
        featureFlagClientAssertionStrictClaimsValidation &&
        !headerStrictParseResult.success
          ? clientAssertionInvalidClaims(
              headerStrictParseResult.error.message,
              "header"
            )
          : undefined,
        featureFlagClientAssertionStrictClaimsValidation &&
        !payloadStrictParseResult.success
          ? clientAssertionInvalidClaims(
              payloadStrictParseResult.error.message,
              "payload"
            )
          : undefined,
      ].filter(Boolean);

      if (strictParsingErrors.length > 0) {
        return failedValidation(strictParsingErrors);
      }

      const result: ClientAssertion = {
        header: {
          kid: validatedKid,
          alg: validatedAlg,
          typ: decodedHeader.typ,
        },
        payload: {
          sub: validatedSub,
          purposeId: validatedPurposeId,
          jti: validatedJti,
          iat: validatedIat,
          iss: validatedIss,
          aud: validatedAud,
          exp: validatedExp,
          digest: validatedDigest,
        },
      };
      return successfulValidation(result);
    }
    return failedValidation([
      jtiErrors,
      iatErrors,
      expErrors,
      issErrors,
      subErrors,
      purposeIdErrors,
      kidErrors,
      audErrors,
      algErrors,
      digestErrors,
    ]);
  } catch (error) {
    if (error instanceof JWTInvalid) {
      return failedValidation([invalidClientAssertionFormat(error.message)]);
    }
    const message = error instanceof Error ? error.message : "generic error";
    return failedValidation([unexpectedClientAssertionPayload(message)]);
  }
};

export const verifyClientAssertionSignature = async (
  clientAssertionJws: string,
  key: TokenGenerationStatesGenericClient,
  clientAssertionAlgorithm: string
): Promise<ValidationResult<jose.JWTPayload>> => {
  try {
    if (clientAssertionAlgorithm !== ALLOWED_ALGORITHM) {
      return failedValidation([algorithmNotAllowed(clientAssertionAlgorithm)]);
    }

    if (!Base64Encoded.safeParse(key.publicKey).success) {
      // Unexpected, because we always store public keys
      // in base64 encoded PEM format
      return failedValidation([
        unexpectedClientAssertionSignatureVerificationError(
          "public key shall be a base64 encoded PEM"
        ),
      ]);
    }

    // Note: we use our common function based on crypto to import the public key,
    // instead of using the dedicated function from jose.
    // Why:
    // - it's the same function we use to create the public key when adding it to the client
    // - jose throws an error in case of keys with missing trailing newline, while crypto does not
    // See keyImport.test.ts
    // See also Jose docs, it accepts crypto KeyObject as well: https://github.com/panva/jose/blob/main/docs/types/types.KeyLike.md
    const publicKey = createPublicKey({ key: key.publicKey });

    const result = await jose.jwtVerify(clientAssertionJws, publicKey, {
      algorithms: [clientAssertionAlgorithm],
    });

    return successfulValidation(result.payload);
  } catch (error: unknown) {
    if (error instanceof JWTExpired) {
      return failedValidation([tokenExpiredError()]);
    } else if (error instanceof JWSSignatureVerificationFailed) {
      return failedValidation([invalidSignature()]);
    } else if (error instanceof JWTClaimValidationFailed) {
      if (error.claim === "nbf") {
        return failedValidation([notBeforeError()]);
      }
      return failedValidation([jsonWebTokenError(error.message)]);
    } else if (error instanceof JWSInvalid) {
      return failedValidation([jsonWebTokenError(error.message)]);
    } else if (error instanceof JOSEError) {
      return failedValidation([
        clientAssertionSignatureVerificationError(error.message),
      ]);
    } else {
      const message = error instanceof Error ? error.message : "generic error";
      return failedValidation([
        unexpectedClientAssertionSignatureVerificationError(message),
      ]);
    }
  }
};

export const validateClientKindAndPlatformState = (
  key: TokenGenerationStatesGenericClient,
  jwt: ClientAssertion
): ValidationResult<ClientAssertion> =>
  match(key)
    .with({ clientKind: clientKindTokenGenStates.api }, () =>
      successfulValidation(jwt)
    )
    .with({ clientKind: clientKindTokenGenStates.consumer }, (key) => {
      const { errors: platformStateErrors } = validatePlatformState(key);
      const purposeIdError = jwt.payload.purposeId
        ? undefined
        : purposeIdNotProvided();

      if (!platformStateErrors && !purposeIdError) {
        return successfulValidation(jwt);
      }

      return failedValidation([platformStateErrors, purposeIdError]);
    })
    .exhaustive();
