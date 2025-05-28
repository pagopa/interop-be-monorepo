import {
  algorithm,
  Algorithm,
  ApiError,
  JWKKey,
  JWKKeyES,
} from "pagopa-interop-models";
import * as jose from "jose";
import { dateToSeconds } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  FailedValidation,
  ValidationResult,
  SuccessfulValidation,
} from "../types.js";
import {
  dpopAlgorithmsMismatch,
  dpopAlgorithmNotAllowed,
  dpopAlgorithmNotFound,
  ErrorCodes,
  expiredDPoPProof,
  dpopHTMNotFound,
  dpopHTUNotFound,
  invalidDPoPHtm,
  invalidDPoPHtu,
  dpopJTINotFound,
  dpopJWKNotFound,
  dpopTYPNotFound,
  invalidDPoPTyp,
  dpopIATNotFound,
} from "../errors.js";

const EXPECTED_TYP = "dpop+jwt";
const EXPECTED_HTM = "POST";
const ALLOWED_ALGORITHMS: string[] = Algorithm.options;

export const validateTyp = (
  typ: string | undefined
): ValidationResult<string> => {
  if (!typ) {
    return failedValidation([dpopTYPNotFound()]);
  }

  if (typ !== EXPECTED_TYP) {
    return failedValidation([invalidDPoPTyp(typ)]);
  }

  return successfulValidation(typ);
};

export const validateAlgorithm = (
  alg: string | undefined,
  jwkAlg: string | undefined
): ValidationResult<string> => {
  if (!alg || !jwkAlg) {
    return failedValidation([dpopAlgorithmNotFound()]);
  }

  if (alg !== jwkAlg) {
    return failedValidation([dpopAlgorithmsMismatch(alg, jwkAlg)]);
  }

  if (ALLOWED_ALGORITHMS.includes(alg) && ALLOWED_ALGORITHMS.includes(jwkAlg)) {
    return successfulValidation(alg);
  }

  return failedValidation([dpopAlgorithmNotAllowed(alg)]);
};

export const validateJWK = (
  jwk: jose.JWK | undefined
): ValidationResult<JWKKey | JWKKeyES> => {
  if (!jwk) {
    return failedValidation([dpopJWKNotFound()]);
  }

  return match(jwk.alg)
    .with(algorithm.ES256, () => successfulValidation(JWKKeyES.parse(jwk)))
    .with(algorithm.RS256, () => successfulValidation(JWKKey.parse(jwk)))
    .with(undefined, () => failedValidation([dpopAlgorithmNotFound()]))
    .otherwise((alg) => failedValidation([dpopAlgorithmNotAllowed(alg)]));
};

export const validateHtm = (
  htm: unknown | undefined
): ValidationResult<string> => {
  if (!htm) {
    return failedValidation([dpopHTMNotFound()]);
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
    return failedValidation([dpopHTUNotFound()]);
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
    return failedValidation([dpopIATNotFound()]);
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
    return failedValidation([dpopJTINotFound()]);
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
