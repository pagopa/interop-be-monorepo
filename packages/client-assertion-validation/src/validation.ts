import { match } from "ts-pattern";
import { clientKindTokenStates } from "pagopa-interop-models";
import { decodeJwt, importSPKI, JWTPayload, jwtVerify } from "jose";
import {
  JOSEError,
  JWSInvalid,
  JWSSignatureVerificationFailed,
  JWTClaimValidationFailed,
  JWTExpired,
  JWTInvalid,
} from "jose/errors";
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
  ApiKey,
  Base64Encoded,
  ClientAssertion,
  ClientAssertionHeader,
  ClientAssertionPayload,
  ClientAssertionValidationRequest,
  ConsumerKey,
  Key,
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
  clientId: string | undefined
): ValidationResult<ClientAssertion> => {
  try {
    const decodedPayload = decodeJwt(clientAssertionJws);
    const encodedHeader = clientAssertionJws.split(".").at(0);
    const decodedHeader =
      encodedHeader &&
      JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));

    if (!decodedPayload || !decodedHeader) {
      return failedValidation([invalidClientAssertionFormat()]);
    }

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
      decodedPayload.aud
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
      const payloadParseResult =
        ClientAssertionPayload.safeParse(decodedPayload);
      if (!payloadParseResult.success) {
        return failedValidation([
          clientAssertionInvalidClaims(payloadParseResult.error.message),
        ]);
      }

      const headerParseResult = ClientAssertionHeader.safeParse(decodedHeader);

      if (!headerParseResult.success) {
        return failedValidation([
          clientAssertionInvalidClaims(headerParseResult.error.message),
        ]);
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
      return failedValidation([invalidClientAssertionFormat()]);
    }
    const message = error instanceof Error ? error.message : "generic error";
    return failedValidation([unexpectedClientAssertionPayload(message)]);
  }
};

export const verifyClientAssertionSignature = async (
  clientAssertionJws: string,
  key: Key
): Promise<ValidationResult<JWTPayload>> => {
  try {
    if (key.algorithm !== ALLOWED_ALGORITHM) {
      return failedValidation([algorithmNotAllowed(key.algorithm)]);
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

    const decoded = Buffer.from(key.publicKey, "base64").toString("utf8");
    const publicKey = await importSPKI(decoded, key.algorithm);

    const result = await jwtVerify(clientAssertionJws, publicKey, {
      algorithms: [key.algorithm],
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
  key: ApiKey | ConsumerKey,
  jwt: ClientAssertion
): ValidationResult<ClientAssertion> =>
  match(key)
    .with({ clientKind: clientKindTokenStates.api }, () =>
      successfulValidation(jwt)
    )
    .with({ clientKind: clientKindTokenStates.consumer }, (key) => {
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
