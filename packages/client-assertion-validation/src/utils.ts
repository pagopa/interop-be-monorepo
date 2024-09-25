/* eslint-disable no-underscore-dangle */
/* eslint-disable functional/immutable-data */
import { ClientId, PurposeId, unsafeBrandId } from "pagopa-interop-models";
import {
  ValidationResult_,
  ValidatedKid,
  ValidatedAlg,
  ValidatedDigest,
  ValidationErrors,
  ValidatedPurposeId,
  ValidatedSub,
  ValidatedIss,
  ValidatedExp,
  ValidatedJti,
  ValidatedIat,
  ValidatedAud,
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
  inactiveAgreement,
  inactiveEService,
  inactivePurpose,
  invalidClientIdFormat,
  invalidSubjectFormat,
  algorithmNotFound,
  algorithmNotAllowed,
  digestClaimNotFound,
  invalidDigestFormat,
  invalidHashLength,
  invalidHashAlgorithm,
  invalidKidFormat,
} from "./errors.js";
import { config } from "./config.js";

export const EXPECTED_CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"; // TODO: env?
export const EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE = "client_credentials"; // TODO: env?
export const ALLOWED_ALGORITHM = "RS256";
const ALLOWED_DIGEST_ALGORITHM = "SHA256";

export const validateJti = (jti?: string): ValidationResult_<ValidatedJti> => {
  if (!jti) {
    return { _errors: [jtiNotFound()] };
  }
  return jti as ValidatedJti;
};

export const validateIat = (iat?: number): ValidationResult_<ValidatedIat> => {
  if (!iat) {
    return { _errors: [issuedAtNotFound()] };
  }
  return iat as ValidatedIat;
};

export const validateExp = (exp?: number): ValidationResult_<ValidatedExp> => {
  if (!exp) {
    return { _errors: [expNotFound()] };
  }
  return exp as ValidatedExp;
};

export const validateIss = (iss?: string): ValidationResult_<ValidatedIss> => {
  if (!iss) {
    return { _errors: [issuerNotFound()] };
  }
  return iss as ValidatedIss;
};

export const validateSub = (
  // TODO requires refactor
  sub?: string,
  clientId?: string
): ValidationResult_<ValidatedSub> => {
  if (!sub) {
    return { _errors: [subjectNotFound()] };
  }
  if (clientId) {
    const validationErrors: ValidationErrors = { _errors: [] };

    if (!ClientId.safeParse(clientId).success) {
      validationErrors._errors.push(invalidClientIdFormat(clientId));
    }

    if (!ClientId.safeParse(sub).success) {
      validationErrors._errors.push(invalidSubjectFormat(sub));
    }

    if (validationErrors._errors.length > 0) {
      return validationErrors;
    }

    // TODO: clientId undefined OK?
    if (sub !== clientId) {
      return { _errors: [invalidSubject(sub)] };
    }
  }
  return sub as ValidatedSub;
};

export const validatePurposeId = (
  purposeId?: string
): ValidationResult_<ValidatedPurposeId | undefined> => {
  if (purposeId && !PurposeId.safeParse(purposeId).success) {
    return { _errors: [invalidPurposeIdClaimFormat(purposeId)] };
  }
  const validatedPurposeId = purposeId
    ? unsafeBrandId<PurposeId>(purposeId)
    : undefined;

  return validatedPurposeId as ValidatedPurposeId | undefined;
};

export const validateKid = (kid?: string): ValidationResult_<ValidatedKid> => {
  if (!kid) {
    return { _errors: [kidNotFound()] };
  }
  const alphanumericRegex = new RegExp("^[a-zA-Z0-9]+$");
  if (alphanumericRegex.test(kid)) {
    return kid as ValidatedKid;
  }
  return { _errors: [invalidKidFormat()] };
};

export const validateAudience = (
  aud: string | string[] | undefined
): ValidationResult_<ValidatedAud> => {
  if (aud === config.clientAssertionAudience) {
    return [aud] as ValidatedAud;
  }

  if (!Array.isArray(aud)) {
    return { _errors: [invalidAudienceFormat()] };
  }
  if (!aud.includes(config.clientAssertionAudience)) {
    return { _errors: [invalidAudience()] };
  }
  return aud as ValidatedAud;
};

export const validateAlgorithm = (
  alg?: string
): ValidationResult_<ValidatedAlg> => {
  if (!alg) {
    return { _errors: [algorithmNotFound()] };
  }
  if (alg === ALLOWED_ALGORITHM) {
    return alg as ValidatedAlg;
  }
  return { _errors: [algorithmNotAllowed(alg)] };
};

export const validateDigest = (
  digest?: object
): ValidationResult_<ValidatedDigest> => {
  if (!digest) {
    return { _errors: [digestClaimNotFound()] };
  }
  const result = ClientAssertionDigest.safeParse(digest);
  if (!result.success) {
    return { _errors: [invalidDigestFormat()] };
  }

  const validatedDigest = result.data;
  const validationErrors: ValidationErrors = { _errors: [] };

  if (validatedDigest.value.length !== 64) {
    validationErrors._errors.push(invalidHashLength(validatedDigest.alg));
  }

  if (validatedDigest.alg !== ALLOWED_DIGEST_ALGORITHM) {
    validationErrors._errors.push(invalidHashAlgorithm());
  }

  if (validationErrors._errors.length > 0) {
    return validationErrors;
  }

  return result.data as ValidatedDigest;
};

// export const validatePlatformState = (
//   // TODO requires refactor
//   key: ConsumerKey
// ): ValidationResult<ConsumerKey> => {
//   const agreementError =
//     key.agreementState !== itemState.active ? inactiveAgreement() : undefined;

//   const descriptorError =
//     key.descriptorState !== itemState.active ? inactiveEService() : undefined;

//   const purposeError =
//     key.purposeState !== itemState.active ? inactivePurpose() : undefined;

//   if (!agreementError && !descriptorError && !purposeError) {
//     return successfulValidation(key);
//   }
//   return failedValidation([agreementError, descriptorError, purposeError]);
// };
