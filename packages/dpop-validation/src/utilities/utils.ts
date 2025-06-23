import {
  Algorithm,
  ApiError,
  JWKKeyRS256,
  JWKKeyES256,
} from "pagopa-interop-models";
import * as jose from "jose";
import { dateToSeconds } from "pagopa-interop-commons";
import {
  FailedValidation,
  ValidationResult,
  SuccessfulValidation,
} from "../types.js";
import {
  dpopAlgorithmNotAllowed,
  dpopAlgorithmNotFound,
  ErrorCodes,
  expiredDPoPProof,
  dpopHtmNotFound,
  dpopHtuNotFound,
  invalidDPoPHtm,
  invalidDPoPHtu,
  dpopJtiNotFound,
  dpopJwkNotFound,
  dpopTypNotFound,
  invalidDPoPTyp,
  dpopIatNotFound,
} from "../errors.js";

const EXPECTED_TYP = "dpop+jwt";
const EXPECTED_HTM = "POST";
const ALLOWED_ALGORITHMS: string[] = Algorithm.options;

export const validateTyp = (
  typ: string | undefined
): ValidationResult<string> => {
  if (!typ) {
    return failedValidation([dpopTypNotFound()]);
  }

  if (typ !== EXPECTED_TYP) {
    return failedValidation([invalidDPoPTyp(typ)]);
  }

  return successfulValidation(typ);
};

export const validateAlgorithm = (
  alg: string | undefined
): ValidationResult<string> => {
  if (!alg) {
    return failedValidation([dpopAlgorithmNotFound()]);
  }

  if (ALLOWED_ALGORITHMS.includes(alg)) {
    return successfulValidation(alg);
  }

  return failedValidation([dpopAlgorithmNotAllowed(alg)]);
};

export const validateJWK = (
  jwk: jose.JWK | undefined
): ValidationResult<JWKKeyRS256 | JWKKeyES256> => {
  if (!jwk) {
    return failedValidation([dpopJwkNotFound()]);
  }

  return successfulValidation(JWKKeyRS256.or(JWKKeyES256).parse(jwk));
};

export const validateHtm = (
  htm: unknown | undefined
): ValidationResult<string> => {
  if (!htm) {
    return failedValidation([dpopHtmNotFound()]);
  }

  if (htm !== EXPECTED_HTM) {
    return failedValidation([invalidDPoPHtm(htm)]);
  }

  return successfulValidation(htm);
};

export const validateHtu = (
  htu: unknown | undefined,
  expectedDPoPProofHtu: string
): ValidationResult<string> => {
  if (!htu) {
    return failedValidation([dpopHtuNotFound()]);
  }

  if (htu !== expectedDPoPProofHtu) {
    return failedValidation([invalidDPoPHtu(htu)]);
  }

  return successfulValidation(htu);
};

export const validateIat = (
  iat: number | undefined
): ValidationResult<number> => {
  if (!iat) {
    return failedValidation([dpopIatNotFound()]);
  }

  const currentTime = dateToSeconds(new Date());
  if (currentTime < iat || currentTime > iat + 60) {
    return failedValidation([expiredDPoPProof(iat, currentTime)]);
  }

  return successfulValidation(iat);
};

export const validateJti = (
  jti: string | undefined
): ValidationResult<string> => {
  if (!jti) {
    return failedValidation([dpopJtiNotFound()]);
  }
  return successfulValidation(jti);
};

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
