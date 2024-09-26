/* eslint-disable no-underscore-dangle */
/* eslint-disable functional/immutable-data */
import {
  ClientId,
  itemState,
  PurposeId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  ValidationResult,
  ValidatedKid,
  ValidatedAlg,
  ValidatedDigest,
  ValidatedPurposeId,
  ValidatedSub,
  ValidatedIss,
  ValidatedExp,
  ValidatedJti,
  ValidatedIat,
  ValidatedAud,
  SuccessfulValidation,
  FailedValidation,
  ClientAssertionDigest,
  ConsumerKey,
} from "./types.js";
import {
  expNotFound,
  issuedAtNotFound,
  invalidAudience,
  invalidAudienceFormat,
  issuerNotFound,
  jtiNotFound,
  subjectNotFound,
  invalidSubject,
  invalidPurposeIdClaimFormat,
  kidNotFound,
  invalidClientIdFormat,
  invalidSubjectFormat,
  algorithmNotFound,
  algorithmNotAllowed,
  digestClaimNotFound,
  invalidDigestFormat,
  invalidHashLength,
  invalidHashAlgorithm,
  invalidKidFormat,
  inactivePurpose,
  inactiveEService,
  inactiveAgreement,
} from "./errors.js";
import { config } from "./config.js";

export const EXPECTED_CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"; // TODO: env?
export const EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE = "client_credentials"; // TODO: env?
export const ALLOWED_ALGORITHM = "RS256";
const ALLOWED_DIGEST_ALGORITHM = "SHA256";

export const failedValidation = (
  errors: FailedValidation["errors"]
): FailedValidation => ({
  hasSucceeded: false,
  errors,
});

export const successfulValidation = <T>(data: T): SuccessfulValidation<T> => ({
  hasSucceeded: true,
  data,
});

export const validateJti = (jti?: string): ValidationResult<ValidatedJti> => {
  if (!jti) {
    return failedValidation([jtiNotFound()]);
  }
  return successfulValidation(jti as ValidatedJti);
};

export const validateIat = (iat?: number): ValidationResult<ValidatedIat> => {
  if (!iat) {
    return failedValidation([issuedAtNotFound()]);
  }
  return successfulValidation(iat as ValidatedIat);
};

export const validateExp = (exp?: number): ValidationResult<ValidatedExp> => {
  if (!exp) {
    return failedValidation([expNotFound()]);
  }
  return successfulValidation(exp as ValidatedExp);
};

export const validateIss = (iss?: string): ValidationResult<ValidatedIss> => {
  if (!iss) {
    return failedValidation([issuerNotFound()]);
  }
  return successfulValidation(iss as ValidatedIss);
};

export const validateSub = (
  // TODO requires refactor
  sub?: string,
  clientId?: string
): ValidationResult<ValidatedSub> => {
  if (!sub) {
    return failedValidation([subjectNotFound()]);
  }
  if (clientId) {
    const FailedValidations: FailedValidation["errors"] = [];

    if (!ClientId.safeParse(clientId).success) {
      FailedValidations.push(invalidClientIdFormat(clientId));
    }

    if (!ClientId.safeParse(sub).success) {
      FailedValidations.push(invalidSubjectFormat(sub));
    }

    if (FailedValidations.length > 0) {
      return failedValidation(FailedValidations);
    }

    // TODO: clientId undefined OK?
    if (sub !== clientId) {
      return failedValidation([invalidSubject(sub)]);
    }
  }
  return successfulValidation(sub as ValidatedSub);
};

export const validatePurposeId = (
  purposeId?: string
): ValidationResult<ValidatedPurposeId | undefined> => {
  if (purposeId && !PurposeId.safeParse(purposeId).success) {
    return failedValidation([invalidPurposeIdClaimFormat(purposeId)]);
  }
  const validatedPurposeId = purposeId
    ? unsafeBrandId<PurposeId>(purposeId)
    : undefined;

  return successfulValidation(
    validatedPurposeId as ValidatedPurposeId | undefined
  );
};

export const validateKid = (kid?: string): ValidationResult<ValidatedKid> => {
  if (!kid) {
    return failedValidation([kidNotFound()]);
  }
  const alphanumericRegex = new RegExp("^[a-zA-Z0-9]+$");
  if (alphanumericRegex.test(kid)) {
    return successfulValidation(kid as ValidatedKid);
  }
  return failedValidation([invalidKidFormat()]);
};

export const validateAudience = (
  aud: string | string[] | undefined
): ValidationResult<ValidatedAud> => {
  if (aud === config.clientAssertionAudience) {
    return successfulValidation([aud] as ValidatedAud);
  }

  if (!Array.isArray(aud)) {
    return failedValidation([invalidAudienceFormat()]);
  }
  if (!aud.includes(config.clientAssertionAudience)) {
    return failedValidation([invalidAudience()]);
  }
  return successfulValidation(aud as ValidatedAud);
};

export const validateAlgorithm = (
  alg?: string
): ValidationResult<ValidatedAlg> => {
  if (!alg) {
    return failedValidation([algorithmNotFound()]);
  }
  if (alg === ALLOWED_ALGORITHM) {
    return successfulValidation(alg as ValidatedAlg);
  }
  return failedValidation([algorithmNotAllowed(alg)]);
};

export const validateDigest = (
  digest?: object
): ValidationResult<ValidatedDigest> => {
  if (!digest) {
    return failedValidation([digestClaimNotFound()]);
  }
  const result = ClientAssertionDigest.safeParse(digest);
  if (!result.success) {
    return failedValidation([invalidDigestFormat()]);
  }

  const validatedDigest = result.data;
  const failedValidations: FailedValidation["errors"] = [];

  if (validatedDigest.value.length !== 64) {
    failedValidations.push(invalidHashLength(validatedDigest.alg));
  }

  if (validatedDigest.alg !== ALLOWED_DIGEST_ALGORITHM) {
    failedValidations.push(invalidHashAlgorithm());
  }

  if (failedValidations.length > 0) {
    return failedValidation(failedValidations);
  }

  return successfulValidation(result.data as ValidatedDigest);
};

export const validatePlatformState = (
  // TODO requires refactor
  key: ConsumerKey
): ValidationResult<ConsumerKey> => {
  const validationErrors: FailedValidation["errors"] = [];

  if (key.agreementState !== itemState.active) {
    validationErrors.push(inactiveAgreement());
  }

  if (key.descriptorState !== itemState.active) {
    validationErrors.push(inactiveEService());
  }

  if (key.purposeState !== itemState.active) {
    validationErrors.push(inactivePurpose());
  }

  if (validationErrors.length === 0) {
    return successfulValidation(key);
  }
  return failedValidation(validationErrors);
};
