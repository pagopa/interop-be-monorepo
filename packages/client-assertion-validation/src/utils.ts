/* eslint-disable functional/immutable-data */
import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  decode,
  JsonWebTokenError,
  NotBeforeError,
  TokenExpiredError,
  verify,
} from "jsonwebtoken";
import { ApiError, PurposeId } from "pagopa-interop-models";
import { ConsumerKey, Key } from "./types.js";
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
} from "./errors.js";
const CLIENT_ASSERTION_AUDIENCE = "DEFAULT_AUDIENCE"; // To do: env?

export const validateRequestParameters = (
  request: authorizationServerApi.AccessTokenRequest
): Array<ApiError<ErrorCodes>> => {
  const expectedClientAssertionType: string =
    "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"; // To do: env?
  const expectedClientCredentialsGrantType: string = "client_credentials"; // To do: env?

  const errors: Array<ApiError<ErrorCodes>> = [];
  if (request.client_assertion_type !== expectedClientAssertionType) {
    // throw Error(
    //   `Unexpected client assertion type. Received ${request.client_assertion_type}`
    // );
    // eslint-disable-next-line functional/immutable-data
    errors.push(invalidAssertionType(request.client_assertion_type));
  }
  if (request.grant_type !== expectedClientCredentialsGrantType) {
    // clientAssertionValidationFailure(
    //   `Unexpected client assertion type. Received ${request.client_assertion_type}`
    // );
    // throw Error(`Unexpected grant type. Received ${request.grant_type}`);
    // eslint-disable-next-line functional/immutable-data
    errors.push(invalidGrantType(request.grant_type));
  }

  return errors;
};

export const verifyClientAssertion = (
  clientAssertionJws: string,
  clientId: string | undefined
): Array<ApiError<ErrorCodes>> => {
  const decoded = decode(clientAssertionJws, { complete: true, json: true });

  console.log("decoded ", decoded);
  const validateAudience = (
    aud: string | string[] | undefined
  ): {
    audienceErrors: Array<ApiError<ErrorCodes>>;
    validatedAudience: string[];
  } => {
    if (aud === CLIENT_ASSERTION_AUDIENCE) {
      return { audienceErrors: [], validatedAudience: [aud] };
    }

    if (!Array.isArray(aud)) {
      // To do: how to test this if the aud type is string[]
      // throw Error("Audience must be an array");
      return {
        audienceErrors: [invalidAudienceFormat()],
        validatedAudience: [], // to do check fallback value []
      };
    } else {
      if (!aud.includes(CLIENT_ASSERTION_AUDIENCE)) {
        return { audienceErrors: [invalidAudience()], validatedAudience: [] }; // to do check fallback value []
        // throw Error("Unexpected client assertion audience");
      }
      return { audienceErrors: [], validatedAudience: aud };
    }
  };

  const errors: Array<ApiError<ErrorCodes>> = [];
  if (!decoded) {
    errors.push(invalidClientAssertionFormat());
  } else {
    if (typeof decoded.payload === "string") {
      errors.push(unexpectedClientAssertionPayload()); // To do: how to test?
    } else {
      if (!decoded.payload.jti) {
        errors.push(jtiNotFound());
      }

      if (!decoded.payload.iat) {
        errors.push(issuedAtNotFound());
      }

      if (!decoded.payload.exp) {
        errors.push(expNotFound());
      }

      if (!decoded.payload.iss) {
        errors.push(issuerNotFound());
      }

      if (!decoded.payload.sub) {
        errors.push(subjectNotFound());
      }

      if (clientId && decoded.payload.sub !== clientId) {
        errors.push(invalidSubject());
      }

      if (
        decoded.payload.purposeId &&
        !PurposeId.safeParse(decoded.payload.purposeId).success
      ) {
        errors.push(invalidPurposeIdClaimFormat());
      }

      const { audienceErrors } = validateAudience(decoded.payload.aud);

      errors.push(...audienceErrors);
    }

    if (!decoded.header.kid) {
      errors.push(kidNotFound());
    }

    // This will return a Client Assertion
    // return {
    //   header: {
    //     kid: decoded.header.kid,
    //     alg: decoded.header.alg,
    //   },
    //   payload: {
    //     sub: decoded.payload.sub,
    //     purposeId: decoded.payload.purposeId,
    //     jti: decoded.payload.jti,
    //     iat: decoded.payload.iat,
    //     iss: decoded.payload.iss,
    //     aud: validatedAudience,
    //     exp: decoded.payload.exp, // TODO Check unit of measure
    //   },
    // };
  }

  return errors;
};

export const b64Decode = (str: string): string =>
  Buffer.from(str, "base64").toString("binary");

export const verifyClientAssertionSignature = (
  clientAssertionJws: string,
  key: Key
): Array<ApiError<ErrorCodes>> => {
  // should this return a JwtPayload?
  try {
    const result = verify(clientAssertionJws, b64Decode(key.publicKey), {
      algorithms: [key.algorithm],
    });

    // TODO Improve this
    if (typeof result === "string") {
      return [Error("Unexpected assertion verification result")];
    } else {
      return [];
    }
  } catch (error: unknown) {
    if (error instanceof TokenExpiredError) {
      console.log("TokenExpiredError");
      return [error];
    } else if (error instanceof JsonWebTokenError) {
      console.log("JsonWebTokenError");
      return [error];
    } else if (error instanceof NotBeforeError) {
      console.log("NotBeforeError");
      return [error];
    } else {
      console.log("unknown error");
      return [Error("unknown error")];
    }
  }
};

export const assertValidPlatformState = (
  key: ConsumerKey
): Array<ApiError<ErrorCodes>> => {
  // To do: is it ok to have these check throwing errors? So that they can be read if needed (instead of just getting false)
  const errors: Array<ApiError<ErrorCodes>> = [];
  if (key.agreementState !== "ACTIVE") {
    errors.push(Error("Invalid agreement state"));
  }
  if (key.descriptorState !== "ACTIVE") {
    errors.push(Error("Invalid eservice state"));
  }
  if (key.purposeState !== "ACTIVE") {
    errors.push(Error("Invalid purpose state"));
  }
  return errors;
};
