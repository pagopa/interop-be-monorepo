import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  decode,
  JsonWebTokenError,
  JwtPayload,
  NotBeforeError,
  TokenExpiredError,
  verify,
} from "jsonwebtoken";
import {
  ApiError,
  ClientId,
  clientKindTokenStates,
  PurposeId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  ApiKey,
  ClientAssertion,
  ClientAssertionDigest,
  ConsumerKey,
  FailedValidation,
  ValidationResult,
  Key,
  SuccessfulValidation,
} from "./types.js";
import {
  ErrorCodes,
  expNotFound,
  issuedAtNotFound,
  invalidAssertionType,
  invalidAudience,
  invalidAudienceFormat,
  invalidClientAssertionFormat,
  invalidGrantType,
  issuerNotFound,
  jtiNotFound,
  subjectNotFound,
  unexpectedClientAssertionPayload,
  invalidSubject,
  invalidPurposeIdClaimFormat,
  kidNotFound,
  inactiveAgreement,
  inactiveEService,
  inactivePurpose,
  tokenExpiredError,
  jsonWebTokenError,
  notBeforeError,
  clientAssertionSignatureVerificationFailure,
  invalidClientAssertionSignatureType,
  invalidClientIdFormat,
  invalidSubjectFormat,
  algorithmNotFound,
  algorithmNotAllowed,
  digestClaimNotFound,
  invalidDigestFormat,
  invalidHashLength,
  invalidHashAlgorithm,
  invalidKidFormat,
  unexpectedKeyType,
  purposeIdNotProvided,
} from "./errors.js";
const CLIENT_ASSERTION_AUDIENCE = "test.interop.pagopa.it"; // TODO: env?
const EXPECTED_CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"; // TODO: env?
const EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE = "client_credentials"; // TODO: env?
const ALLOWED_ALGORITHM = "RS256";
const ALLOWED_DIGEST_ALGORITHM = "SHA256";

export const validateRequestParameters = (
  request: authorizationServerApi.AccessTokenRequest
): ValidationResult<authorizationServerApi.AccessTokenRequest> => {
  const assertionTypeError =
    request.client_assertion_type !== EXPECTED_CLIENT_ASSERTION_TYPE
      ? invalidAssertionType(request.client_assertion_type)
      : undefined;

  // TODO: this might be useless because authorizationServerApi.AccessTokenRequest has the string hard coded
  const grantTypeError =
    request.grant_type !== EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE
      ? invalidGrantType(request.grant_type)
      : undefined;

  if (!assertionTypeError && !grantTypeError) {
    return successfulValidation(request);
  }
  return failedValidation([assertionTypeError, grantTypeError]);
};

const validateJti = (jti?: string): ValidationResult<string> => {
  if (!jti) {
    return failedValidation([jtiNotFound()]);
  }
  return successfulValidation(jti);
};

const validateIat = (iat?: number): ValidationResult<number> => {
  if (!iat) {
    return failedValidation([issuedAtNotFound()]);
  }
  return successfulValidation(iat);
};

const validateExp = (exp?: number): ValidationResult<number> => {
  if (!exp) {
    return failedValidation([expNotFound()]);
  }
  return successfulValidation(exp);
};

const validateIss = (iss?: string): ValidationResult<string> => {
  if (!iss) {
    return failedValidation([issuerNotFound()]);
  }
  return successfulValidation(iss);
};

const validateSub = (
  sub?: string,
  clientId?: string
): ValidationResult<string> => {
  if (!sub) {
    return failedValidation([subjectNotFound()]);
  }
  if (clientId) {
    const clientIdError = !ClientId.safeParse(clientId).success
      ? invalidClientIdFormat(clientId)
      : undefined;
    const invalidSubFormatError = !ClientId.safeParse(sub).success
      ? invalidSubjectFormat(sub)
      : undefined;
    if (clientIdError || invalidSubFormatError) {
      return failedValidation([clientIdError, invalidSubFormatError]);
    }
    // TODO: clientId undefined OK?
    if (sub !== clientId) {
      return failedValidation([invalidSubject(sub)]);
    }
  }
  return successfulValidation(sub);
};

const validatePurposeId = (
  purposeId?: string
): ValidationResult<PurposeId | undefined> => {
  if (purposeId && !PurposeId.safeParse(purposeId).success) {
    return failedValidation([invalidPurposeIdClaimFormat(purposeId)]);
  }
  const validatedPurposeId = purposeId
    ? unsafeBrandId<PurposeId>(purposeId)
    : undefined;
  return successfulValidation(validatedPurposeId);
};

const validateKid = (kid?: string): ValidationResult<string> => {
  if (!kid) {
    return failedValidation([kidNotFound()]);
  }
  const alphanumericRegex = new RegExp("^[a-zA-Z0-9]+$");
  if (alphanumericRegex.test(kid)) {
    return successfulValidation(kid);
  }
  return failedValidation([invalidKidFormat()]);
};

const validateAudience = (
  aud: string | string[] | undefined
): ValidationResult<string[]> => {
  if (aud === CLIENT_ASSERTION_AUDIENCE) {
    return successfulValidation([aud]);
  }

  if (!Array.isArray(aud)) {
    return failedValidation([invalidAudienceFormat()]);
  }
  if (!aud.includes(CLIENT_ASSERTION_AUDIENCE)) {
    return failedValidation([invalidAudience()]);
  }
  return successfulValidation(aud);
};

const validateAlgorithm = (alg?: string): ValidationResult<string> => {
  if (!alg) {
    return failedValidation([algorithmNotFound()]);
  }
  if (alg === ALLOWED_ALGORITHM) {
    return successfulValidation(alg);
  }
  return failedValidation([algorithmNotAllowed(alg)]);
};

const validateDigest = (
  digest?: object
): ValidationResult<ClientAssertionDigest> => {
  if (!digest) {
    return failedValidation([digestClaimNotFound()]);
  }
  const result = ClientAssertionDigest.safeParse(digest);
  if (!result.success) {
    return failedValidation([invalidDigestFormat()]);
  }
  const validatedDigest = result.data;
  const digestLengthError =
    validatedDigest.value.length !== 64
      ? invalidHashLength(validatedDigest.alg)
      : undefined;
  const digestAlgError =
    validatedDigest.alg !== ALLOWED_DIGEST_ALGORITHM
      ? invalidHashAlgorithm()
      : undefined;
  if (!digestLengthError && !digestAlgError) {
    return successfulValidation(result.data);
  }
  return failedValidation([digestLengthError, digestAlgError]);
};

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

    const { errors: jtiErrors, data: validatedJti } = validateJti(
      decoded.payload.jti
    );
    const { errors: iatErrors, data: validatedIat } = validateIat(
      decoded.payload.iat
    );
    const { errors: expErrors, data: validatedExp } = validateExp(
      decoded.payload.exp
    );
    const { errors: issErrors, data: validatedIss } = validateIss(
      decoded.payload.iss
    );
    const { errors: subErrors, data: validatedSub } = validateSub(
      decoded.payload.sub,
      clientId
    );
    const { errors: purposeIdErrors, data: validatedPurposeId } =
      validatePurposeId(decoded.payload.purposeId);
    const { errors: kidErrors, data: validatedKid } = validateKid(
      decoded.header.kid
    );
    const { errors: audErrors, data: validatedAud } = validateAudience(
      decoded.payload.aud
    );
    const { errors: algErrors, data: validatedAlg } = validateAlgorithm(
      decoded.header.alg
    );
    const { errors: digestErrors, data: validatedDigest } = validateDigest(
      decoded.payload.digest
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
      const result: ClientAssertion = {
        header: {
          kid: validatedKid,
          alg: validatedAlg,
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
    return failedValidation([unexpectedClientAssertionPayload()]);
  }
};

// export const b64Decode = (str: string): string =>
//   Buffer.from(str, "base64").toString("binary");

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

export const validatePlatformState = (
  key: ConsumerKey
): ValidationResult<ConsumerKey> => {
  const agreementError =
    key.agreementState !== "ACTIVE" ? inactiveAgreement() : undefined;

  const descriptorError =
    key.descriptorState !== "ACTIVE" ? inactiveEService() : undefined;

  const purposeError =
    key.purposeState !== "ACTIVE" ? inactivePurpose() : undefined;

  if (!agreementError && !descriptorError && !purposeError) {
    return successfulValidation(key);
  }
  return failedValidation([agreementError, descriptorError, purposeError]);
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
        const { errors: platformStateErrors } = validatePlatformState(
          key as ConsumerKey
        );
        const purposeIdError = jwt.payload.purposeId
          ? undefined
          : purposeIdNotProvided();

        if (!platformStateErrors && !purposeIdError) {
          return successfulValidation(jwt);
        }
        return failedValidation([
          ...(platformStateErrors || []),
          purposeIdError,
        ]);
      }
      return failedValidation([
        unexpectedKeyType(clientKindTokenStates.consumer),
      ]);
    })
    .exhaustive();

export const successfulValidation = <T>(
  result: T
): SuccessfulValidation<T> => ({
  data: result,
  errors: undefined,
});

export const failedValidation = (
  // errors: [[error1, error2, undefined], error3, undefined]
  errors: Array<
    Array<ApiError<ErrorCodes> | undefined> | ApiError<ErrorCodes> | undefined
  >
): FailedValidation => {
  const nestedArrayWithoutUndefined = errors.filter((a) => a !== undefined);
  const flattenedArray = nestedArrayWithoutUndefined.flat(1);
  const flattenedArrayWithoutUndefined = flattenedArray.filter(
    (e) => e !== undefined
  );
  return {
    data: undefined,
    errors: flattenedArrayWithoutUndefined,
  };
};
