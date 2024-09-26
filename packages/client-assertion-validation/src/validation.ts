/* eslint-disable functional/immutable-data */
import {
  decode,
  JsonWebTokenError,
  JwtPayload,
  NotBeforeError,
  TokenExpiredError,
  verify,
} from "jsonwebtoken";
import { match, P } from "ts-pattern";
import { clientKindTokenStates, PurposeId } from "pagopa-interop-models";
import {
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
  successfulValidation,
  failedValidation,
  validatePlatformState,
} from "./utils.js";
import {
  ApiKey,
  ClientAssertion,
  ClientAssertionValidationRequest,
  ConsumerKey,
  Key,
  FailedValidation,
  ValidatedClientAssertion,
  ValidationResult,
} from "./types.js";
import {
  clientAssertionSignatureVerificationFailure,
  invalidAssertionType,
  invalidClientAssertionFormat,
  invalidClientAssertionSignatureType,
  invalidGrantType,
  jsonWebTokenError,
  notBeforeError,
  purposeIdNotProvided,
  tokenExpiredError,
  unexpectedClientAssertionPayload,
  unexpectedKeyType,
} from "./errors.js";

export const validateRequestParameters = (
  request: ClientAssertionValidationRequest
): ValidationResult<ClientAssertionValidationRequest> => {
  const validationErrors: FailedValidation["errors"] = [];

  if (request.client_assertion_type !== EXPECTED_CLIENT_ASSERTION_TYPE) {
    validationErrors.push(invalidAssertionType(request.client_assertion_type));
  }

  // TODO: this might be useless because ClientAssertionValidationRequest has the string hard coded
  if (request.grant_type !== EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE) {
    validationErrors.push(invalidGrantType(request.grant_type));
  }

  if (validationErrors.length === 0) {
    return successfulValidation(request);
  }

  return failedValidation(validationErrors);
};

export const verifyClientAssertion = (
  clientAssertionJws: string,
  clientId: string | undefined
): ValidationResult<ClientAssertion> => {
  try {
    const decoded = decode(clientAssertionJws, { complete: true, json: true });
    if (!decoded) {
      return failedValidation([invalidClientAssertionFormat()]);
    }

    if (typeof decoded.payload === "string") {
      return failedValidation([unexpectedClientAssertionPayload()]);
    }

    const kidValidation = validateKid(decoded.header.kid);
    const algValidation = validateAlgorithm(decoded.header.alg);
    const subValidation = validateSub(decoded.payload.sub, clientId);
    const purposeIdValidation = validatePurposeId(decoded.payload.purposeId);
    const jtiValidation = validateJti(decoded.payload.jti);
    const iatValidation = validateIat(decoded.payload.iat);
    const issValidation = validateIss(decoded.payload.iss);
    const audValidation = validateAudience(decoded.payload.aud);
    const expValidation = validateExp(decoded.payload.exp);
    const digestValidation = validateDigest(decoded.payload.digest);

    const errors = [
      kidValidation,
      algValidation,
      subValidation,
      purposeIdValidation,
      jtiValidation,
      iatValidation,
      issValidation,
      audValidation,
      expValidation,
      digestValidation,
    ]
      .filter((validation) => !validation.hasSucceeded)
      .flatMap(({ errors }) => errors);

    if (
      kidValidation.hasSucceeded &&
      algValidation.hasSucceeded &&
      subValidation.hasSucceeded &&
      purposeIdValidation.hasSucceeded &&
      jtiValidation.hasSucceeded &&
      iatValidation.hasSucceeded &&
      issValidation.hasSucceeded &&
      audValidation.hasSucceeded &&
      expValidation.hasSucceeded &&
      digestValidation.hasSucceeded
    ) {
      return successfulValidation({
        header: {
          kid: kidValidation.data,
          alg: algValidation.data,
        },
        payload: {
          sub: subValidation.data,
          purposeId: purposeIdValidation.data,
          jti: jtiValidation.data,
          iat: iatValidation.data,
          iss: issValidation.data,
          aud: audValidation.data,
          exp: expValidation.data,
          digest: digestValidation.data,
        },
      } satisfies ValidatedClientAssertion);
    }

    return failedValidation(errors);
  } catch (error) {
    return failedValidation([unexpectedClientAssertionPayload()]);
  }
};

export const verifyClientAssertionSignature = (
  clientAssertionJws: string,
  key: Key
): ValidationResult<JwtPayload> => {
  try {
    const result = verify(clientAssertionJws, key.publicKey, {
      algorithms: [key.algorithm],
    });

    // TODO: no idea when result is a string
    if (typeof result === "string") {
      return failedValidation([
        invalidClientAssertionSignatureType(typeof result),
      ]);
    }
    return successfulValidation(result);
  } catch (error: unknown) {
    return match(error)
      .with(P.instanceOf(TokenExpiredError), () =>
        failedValidation([tokenExpiredError()])
      )
      .with(P.instanceOf(NotBeforeError), () =>
        failedValidation([notBeforeError()])
      )
      .with(P.instanceOf(JsonWebTokenError), (error) =>
        failedValidation([jsonWebTokenError(error.message)])
      )
      .with(P.instanceOf(TokenExpiredError), () =>
        failedValidation([tokenExpiredError()])
      )
      .otherwise(() =>
        failedValidation([clientAssertionSignatureVerificationFailure()])
      );
  }
};

const validateRequiredPurposeId = (
  purposeId: PurposeId | undefined
): ValidationResult<PurposeId> => {
  if (purposeId) {
    return successfulValidation(purposeId);
  }
  return failedValidation([purposeIdNotProvided()]);
};

export const validateClientKindAndPlatformState = (
  key: ApiKey | ConsumerKey,
  jwt: ClientAssertion
): ValidationResult<ClientAssertion> =>
  match(key.clientKind)
    .with(clientKindTokenStates.api, () =>
      ApiKey.safeParse(key).success
        ? successfulValidation(jwt)
        : failedValidation([unexpectedKeyType(clientKindTokenStates.api)])
    )
    .with(clientKindTokenStates.consumer, () => {
      if (ConsumerKey.safeParse(key).success) {
        const consumerKeyValidation = validatePlatformState(key as ConsumerKey);
        const purposeIdValidation = validateRequiredPurposeId(
          jwt.payload.purposeId
        );

        if (
          consumerKeyValidation.hasSucceeded &&
          purposeIdValidation.hasSucceeded
        ) {
          return successfulValidation(jwt);
        } else {
          const errors = [consumerKeyValidation, purposeIdValidation]
            .filter((validation) => !validation.hasSucceeded)
            .flatMap(({ errors }) => errors);
          return failedValidation(errors);
        }
      }
      return failedValidation([
        unexpectedKeyType(clientKindTokenStates.consumer),
      ]);
    })
    .exhaustive();
