import { ApiError, JWKKey } from "pagopa-interop-models";
import * as jose from "jose";
import { dateToSeconds } from "pagopa-interop-commons";
import {
  FailedValidation,
  ValidationResult,
  SuccessfulValidation,
} from "../types.js";
import {
  algorithmNotAllowed,
  algorithmNotFound,
  ErrorCodes,
  expiredDPoPProof,
  htmNotFound,
  htuNotFound,
  iatNotFound,
  invalidHtm,
  invalidHtu,
  invalidTyp,
  jtiNotFound,
  jwkNotFound,
  typNotFound,
} from "../errors.js";

const EXPECTED_TYP = "dpop+jwt";
const EXPECTED_HTM = "POST";
export const ALLOWED_ALGORITHM = "RS256";

export const validateTyp = (
  typ: string | undefined
): ValidationResult<string> => {
  if (!typ) {
    return failedValidation([typNotFound()]);
  }

  if (typ !== EXPECTED_TYP) {
    return failedValidation([invalidTyp(typ)]);
  }

  return successfulValidation(typ);
};

export const validateAlgorithm = (
  alg: string | undefined
): ValidationResult<string> => {
  if (!alg) {
    return failedValidation([algorithmNotFound()]);
  }

  if (alg === ALLOWED_ALGORITHM) {
    return successfulValidation(alg);
  }

  return failedValidation([algorithmNotAllowed(alg)]);
};

export const validateJWK = (
  jwk: jose.JWK | undefined
): ValidationResult<JWKKey> => {
  if (!jwk) {
    return failedValidation([jwkNotFound()]);
  }
  return successfulValidation(JWKKey.parse(jwk));
};

export const validateHtm = (
  htm: unknown | undefined
): ValidationResult<string> => {
  if (!htm) {
    return failedValidation([htmNotFound()]);
  }

  if (htm !== EXPECTED_HTM) {
    return failedValidation([invalidHtm(htm)]);
  }

  return successfulValidation(htm);
};

export const validateHtu = (
  htu: unknown | undefined,
  expectedDPoPProofHtu: string
): ValidationResult<string> => {
  if (!htu) {
    return failedValidation([htuNotFound()]);
  }

  if (htu !== expectedDPoPProofHtu) {
    return failedValidation([invalidHtu(htu)]);
  }

  return successfulValidation(htu);
};

export const validateIat = (
  iat: number | undefined
): ValidationResult<number> => {
  if (!iat) {
    return failedValidation([iatNotFound()]);
  }

  const currentTime = dateToSeconds(new Date());
  if (currentTime < iat && currentTime > iat + 60) {
    return failedValidation([expiredDPoPProof(iat, currentTime)]);
  }

  return successfulValidation(iat);
};

export const validateJti = (
  jti: string | undefined
): ValidationResult<string> => {
  if (!jti) {
    return failedValidation([jtiNotFound()]);
  }
  return successfulValidation(jti);
};

// TODO: copied from client-assertion-validation
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
): FailedValidation<ErrorCodes> => {
  const nestedArrayWithoutUndefined = errors.filter((a) => a !== undefined);
  const flattenedArray = nestedArrayWithoutUndefined.flat(1);
  const flattenedArrayWithoutUndefined = flattenedArray.filter(
    (e) => e !== undefined
  );
  return {
    data: undefined,
    errors: flattenedArrayWithoutUndefined as Array<ApiError<ErrorCodes>>,
  };
};
