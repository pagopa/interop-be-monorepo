import {
  decode,
  JsonWebTokenError,
  JwtPayload,
  NotBeforeError,
  TokenExpiredError,
  verify,
} from "jsonwebtoken";
import { match } from "ts-pattern";
import { clientKindTokenStates } from "pagopa-interop-models";
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
} from "./utils.js";
import {
  ApiKey,
  ClientAssertion,
  ClientAssertionValidationRequest,
  ConsumerKey,
  Key,
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

/*
TEMPLATE for client assertion validation

export const validateClientAssertion = async (
  request: ClientAssertionValidationRequest,
): Promise<ValidationResult<ClientAssertion>> => {
  const { errors: parametersErrors } = validateRequestParameters(request);

  const { errors: clientAssertionVerificationErrors, data: jwt } =
    verifyClientAssertion(request.client_assertion, request.client_id);

  // TO DO retrieve key


  const { errors: clientAssertionSignatureErrors } =
    verifyClientAssertionSignature(request.client_assertion, key);

  if (
    parametersErrors ||
    clientAssertionVerificationErrors ||
    clientAssertionSignatureErrors
  ) {
    return failedValidation([
      parametersErrors,
      clientAssertionVerificationErrors,
      clientAssertionSignatureErrors,
    ]);
  }
  const { errors: clientKindAndPlatormStateErrors } =
    validateClientKindAndPlatformState(key, jwt);

  if (clientKindAndPlatormStateErrors) {
    return failedValidation([clientAssertionSignatureErrors]);
  }

  return successfulValidation(jwt);
};
*/

export const validateRequestParameters = (
  request: ClientAssertionValidationRequest
): ValidationResult<ClientAssertionValidationRequest> => {
  const assertionTypeError =
    request.client_assertion_type !== EXPECTED_CLIENT_ASSERTION_TYPE
      ? invalidAssertionType(request.client_assertion_type)
      : undefined;

  // TODO: this might be useless because ClientAssertionValidationRequest has the string hard coded
  const grantTypeError =
    request.grant_type !== EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE
      ? invalidGrantType(request.grant_type)
      : undefined;

  if (!assertionTypeError && !grantTypeError) {
    return successfulValidation(request);
  }
  return failedValidation([assertionTypeError, grantTypeError]);
};

type ValidationOutput = {
  jti: ValidationResult<string>;
  iat: ValidationResult<number>;
};

function isValidationSuccess(
  validationResult: ValidationResult<unknown>
): validationResult is Extract<typeof validationResult, { data: unknown }> {
  return "data" in validationResult && Boolean(validationResult.data);
}

function isValidationError(
  validationResult: ValidationResult<unknown>
): validationResult is Extract<typeof validationResult, { errors: unknown }> {
  return "errors" in validationResult && Array.isArray(validationResult.errors);
}

function isAllValidationSuccess(
  validationOutput: ValidationOutput
): validationOutput is {
  [TKey in keyof typeof validationOutput]: Extract<
    (typeof validationOutput)[TKey],
    { data: unknown }
  >;
} {
  return Object.values(validationOutput).every(isValidationSuccess);
}

// eslint-disable-next-line complexity
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

    const validationOutput: ValidationOutput = {
      jti: validateJti(decoded.payload.jti),
      iat: validateIat(decoded.payload.iat),
    };

    if (isAllValidationSuccess(validationOutput)) {
      // build client assertion

      const result: ClientAssertion = {
        header: {
          kid: validatedKid,
          alg: validatedAlg,
        },
        payload: {
          sub: validatedSub,
          purposeId: validatedPurposeId,
          jti: validationOutput.jti.data,
          iat: validationOutput.iat.data,
          iss: validatedIss,
          aud: validatedAud,
          exp: validatedExp,
          digest: validatedDigest,
        },
      };
      return successfulValidation(result);
    }

    const errors = Object.values(validationOutput)
      .filter(isValidationError)
      .flatMap(({ errors }) => errors);
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
    if (error instanceof TokenExpiredError) {
      return failedValidation([tokenExpiredError()]);
    } else if (error instanceof NotBeforeError) {
      return failedValidation([notBeforeError()]);
    } else if (error instanceof JsonWebTokenError) {
      // TODO: this might overlap with invalidClientAssertionFormat raised inside verifyClientAssertion
      return failedValidation([jsonWebTokenError(error.message)]);
    } else {
      return failedValidation([clientAssertionSignatureVerificationFailure()]);
    }
  }
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
        const validationResult = validatePlatformState(key as ConsumerKey);

        if (isValidationSuccess(validationResult)) {
          // ...
        } else {
          validationResult.errors;
        }

        const purposeIdError = jwt.payload.purposeId
          ? undefined
          : purposeIdNotProvided();

        if (!platformStateErrors && !purposeIdError) {
          return successfulValidation(jwt);
        }
        return failedValidation([platformStateErrors, purposeIdError]);
      }
      return failedValidation([
        unexpectedKeyType(clientKindTokenStates.consumer),
      ]);
    })
    .exhaustive();

// const { errors: jtiErrors, data: validatedJti } = validateJti(
//   decoded.payload.jti
// );
// const { errors: iatErrors, data: validatedIat } = validateIat(
//   decoded.payload.iat
// );
// const { errors: expErrors, data: validatedExp } = validateExp(
//   decoded.payload.exp
// );
// const { errors: issErrors, data: validatedIss } = validateIss(
//   decoded.payload.iss
// );
// const { errors: subErrors, data: validatedSub } = validateSub(
//   decoded.payload.sub,
//   clientId
// );
// const { errors: purposeIdErrors, data: validatedPurposeId } =
//   validatePurposeId(decoded.payload.purposeId);
// const { errors: kidErrors, data: validatedKid } = validateKid(
//   decoded.header.kid
// );
// const { errors: audErrors, data: validatedAud } = validateAudience(
//   decoded.payload.aud
// );
// const { errors: algErrors, data: validatedAlg } = validateAlgorithm(
//   decoded.header.alg
// );
// const { errors: digestErrors, data: validatedDigest } = validateDigest(
//   decoded.payload.digest
// );
// if (
//   !jtiErrors &&
//   !iatErrors &&
//   !expErrors &&
//   !issErrors &&
//   !subErrors &&
//   !purposeIdErrors &&
//   !kidErrors &&
//   !audErrors &&
//   !algErrors &&
//   !digestErrors
// ) {
//   const result: ClientAssertion = {
//     header: {
//       kid: validatedKid,
//       alg: validatedAlg,
//     },
//     payload: {
//       sub: validatedSub,
//       purposeId: validatedPurposeId,
//       jti: validatedJti,
//       iat: validatedIat,
//       iss: validatedIss,
//       aud: validatedAud,
//       exp: validatedExp,
//       digest: validatedDigest,
//     },
//   };
//   return successfulValidation(result);
// }
