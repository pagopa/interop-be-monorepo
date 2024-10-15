/* eslint-disable @typescript-eslint/no-non-null-assertion */
import crypto from "crypto";
import { fail } from "assert";
import { describe, expect, it } from "vitest";
import {
  ClientId,
  generateId,
  itemState,
  PurposeId,
} from "pagopa-interop-models";
import {
  validateClientKindAndPlatformState,
  validateRequestParameters,
  verifyClientAssertion,
  verifyClientAssertionSignature,
} from "../src/validation.js";
import { validatePlatformState } from "../src/utils.js";
import {
  algorithmNotAllowed,
  algorithmNotFound,
  digestClaimNotFound,
  expNotFound,
  inactiveAgreement,
  inactiveEService,
  inactivePurpose,
  invalidAudience,
  invalidClientAssertionFormat,
  invalidClientIdFormat,
  invalidHashAlgorithm,
  invalidHashLength,
  invalidKidFormat,
  invalidPurposeIdClaimFormat,
  invalidSubject,
  invalidSubjectFormat,
  issuedAtNotFound,
  issuerNotFound,
  jsonWebTokenError,
  jtiNotFound,
  notBeforeError,
  subjectNotFound,
  tokenExpiredError,
  purposeIdNotProvided,
  invalidGrantType,
  invalidAssertionType,
  invalidSignature,
  clientAssertionInvalidClaims,
  invalidAudienceFormat,
} from "../src/errors.js";
import { ClientAssertionValidationRequest, ConsumerKey } from "../src/types.js";
import {
  getMockAccessTokenRequest,
  getMockApiKey,
  getMockClientAssertion,
  getMockConsumerKey,
  signClientAssertion,
  value64chars,
} from "./utils.js";

describe("validation test", async () => {
  describe("validateRequestParameters", async () => {
    it("success request parameters", async () => {
      const request = await getMockAccessTokenRequest();
      const { errors } = validateRequestParameters(request);
      expect(errors).toBeUndefined();
    });

    it("invalidAssertionType", async () => {
      const wrongAssertionType = "something-wrong";
      const request: ClientAssertionValidationRequest = {
        ...(await getMockAccessTokenRequest()),
        client_assertion_type: wrongAssertionType,
      };
      const { errors } = validateRequestParameters(request);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAssertionType(wrongAssertionType));
    });

    it("invalidGrantType", async () => {
      const wrongGrantType = "something-wrong";
      const request: ClientAssertionValidationRequest = {
        ...(await getMockAccessTokenRequest()),
        grant_type: wrongGrantType,
      };
      const { errors } = validateRequestParameters(request);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidGrantType(wrongGrantType));
    });

    it("invalidAssertionType and invalidGrantType", async () => {
      const wrongAssertionType = "something-wrong";
      const wrongGrantType = "something-wrong";

      const request: ClientAssertionValidationRequest = {
        ...(await getMockAccessTokenRequest()),
        client_assertion_type: wrongAssertionType,
        grant_type: wrongGrantType,
      };
      const { errors } = validateRequestParameters(request);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(2);
      expect(errors).toEqual([
        invalidAssertionType(wrongAssertionType),
        invalidGrantType(wrongGrantType),
      ]);
    });
  });

  describe("verifyClientAssertion", async () => {
    it("success client assertion", async () => {
      const a = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeUndefined();
    });

    it("clientAssertionInvalidClaims - header", async () => {
      const payload = {
        iss: generateId<ClientId>(),
        sub: generateId<ClientId>(),
        aud: ["test.interop.pagopa.it", "dev.interop.pagopa.it"],
        jti: generateId(),
        iat: 5,
        exp: 10,
        digest: {
          alg: "SHA256",
          value: value64chars,
        },
      };

      const headers = {
        kid: "kid",
        alg: "RS256",
        invalidHeaderProp: "wrong",
      };
      const jws = await signClientAssertion({ payload, headers });
      const { errors } = verifyClientAssertion(jws, undefined);

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(clientAssertionInvalidClaims("").code);
    });

    it("clientAssertionInvalidClaims - payload", async () => {
      const a = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {
          wrongPayloadProp: "wrong",
        },
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(clientAssertionInvalidClaims("").code);
    });

    it("wrong signature", async () => {
      const clientAssertion = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {},
      });
      const subStrings = clientAssertion.split(".");
      const clientAssertionWithWrongSignature = `${subStrings[0]}.${subStrings[1]}.wrong-signature`;
      const { errors } = verifyClientAssertion(
        clientAssertionWithWrongSignature,
        undefined
      );
      expect(errors).toBeUndefined();
    });

    it("correctly formatted but invalid signature", async () => {
      const clientAssertion1 = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {},
      });
      const clientAssertion2 = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {},
      });
      const subStrings1 = clientAssertion1.split(".");
      const subStrings2 = clientAssertion2.split(".");

      const clientAssertionWithWrongSignature = `${subStrings1[0]}.${subStrings1[1]}.${subStrings2[2]}`;
      const { errors } = verifyClientAssertion(
        clientAssertionWithWrongSignature,
        undefined
      );
      expect(errors).toBeUndefined();
    });

    it("invalidClientAssertionFormat (malformed jwt)", async () => {
      const { errors: errors1 } = verifyClientAssertion(
        "too.many.substrings.in.client.assertion",
        undefined
      );
      expect(errors1).toBeDefined();
      expect(errors1).toHaveLength(1);
      expect(errors1![0]).toEqual(invalidClientAssertionFormat());

      const { errors: errors2 } = verifyClientAssertion("not a jwt", undefined);
      expect(errors2).toBeDefined();
      expect(errors2).toHaveLength(1);
      expect(errors2![0]).toEqual(invalidClientAssertionFormat());

      const { errors: errors3 } = verifyClientAssertion("not.a.jwt", undefined);
      expect(errors3).toBeDefined();
      expect(errors3).toHaveLength(1);
      expect(errors3![0]).toEqual(invalidClientAssertionFormat());

      const { errors: errors4 } = verifyClientAssertion(
        "signature.missing",
        undefined
      );
      expect(errors4).toBeDefined();
      expect(errors4).toHaveLength(1);
      expect(errors4![0]).toEqual(invalidClientAssertionFormat());
    });

    it("invalidAudience - wrong entry as string", async () => {
      const a = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: { aud: "random" },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudience());
    });

    it("invalidAudience - wrong entry as 1-item array", async () => {
      const a = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: { aud: ["random"] },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudience());
    });

    it("invalidAudienceFormat - comma-separated strings", async () => {
      const a = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: { aud: "test.interop.pagopa.it, other-aud" },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudienceFormat());
    });

    it("invalidAudience - wrong entries", async () => {
      const a = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: { aud: ["wrong-audience1, wrong-audience2"] },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudience());
    });

    it("invalidAudience - missing entry", async () => {
      const a = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {
          aud: ["test.interop.pagopa.it"],
        },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudience());
    });

    it("jtiNotFound", async () => {
      const a = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: { jti: undefined },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(jtiNotFound());
    });

    it("iatNotFound", async () => {
      const a = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {
          iat: undefined,
        },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(issuedAtNotFound());
    });

    it("expNotFound", async () => {
      const payload = {
        iss: generateId<ClientId>(),
        sub: generateId<ClientId>(),
        aud: ["test.interop.pagopa.it", "dev.interop.pagopa.it"],
        jti: generateId(),
        iat: 5,
        digest: {
          alg: "SHA256",
          value: value64chars,
        },
      };

      const headers = {
        kid: "kid",
        alg: "RS256",
      };

      const jws = await signClientAssertion({ payload, headers });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(expNotFound());
    });

    it("issuerNotFound", async () => {
      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: { iss: undefined },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(issuerNotFound());
    });

    it("jtiNotFound and issuerNotFound", async () => {
      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: { jti: undefined, iss: undefined },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(2);
      expect(errors).toEqual([jtiNotFound(), issuerNotFound()]);
    });

    it("subjectNotFound", async () => {
      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: { sub: undefined },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(subjectNotFound());
    });

    it("invalidSubject - Subject claim differs from clientID parameter", async () => {
      const subject = generateId<ClientId>();
      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: { sub: subject },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, generateId<ClientId>());
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidSubject(subject));
    });

    it("invalidSubjectFormat", async () => {
      const clientId: ClientId = generateId();
      const subject = "not a client id";
      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: { sub: subject },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, clientId);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidSubjectFormat(subject));
    });

    it("invalidPurposeIdClaimFormat", async () => {
      const notPurposeId = "not a purpose id";
      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {
          purposeId: notPurposeId,
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidPurposeIdClaimFormat(notPurposeId));
    });

    it("invalidClientIdFormat", async () => {
      const notClientId = "not a client id";
      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, notClientId);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidClientIdFormat(notClientId));
    });

    it("should not throw error if digest is undefined", async () => {
      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {
          digest: undefined,
        },
      });

      const verifiedClientAssertion = verifyClientAssertion(jws, undefined);
      expect(verifiedClientAssertion.data?.payload.digest).toBeUndefined();
    });

    it("digestClaimNotFound", async () => {
      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: { digest: { alg: "alg", invalidProp: true } },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(digestClaimNotFound("").code);
    });

    it("invalidHashLength", async () => {
      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {
          digest: { alg: "SHA256", value: "string of wrong length" },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidHashLength("SHA256"));
    });

    it("InvalidHashAlgorithm", async () => {
      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {
          digest: { alg: "wrong alg", value: value64chars },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidHashAlgorithm());
    });

    it("invalidHashLength and invalidHashAlgorithm", async () => {
      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {
          digest: { alg: "wrong alg", value: "string of wrong length" },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(2);
      expect(errors).toEqual([
        invalidHashLength("wrong alg"),
        invalidHashAlgorithm(),
      ]);
    });

    it.skip("AlgorithmNotFound", async () => {
      // it seems this can't be tested because we need alg header to sign the mock jwt
      const jws = await getMockClientAssertion({
        customHeader: { alg: undefined },
        standardClaimsOverride: {},
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(algorithmNotFound());
    });

    it("AlgorithmNotAllowed", async () => {
      const notAllowedAlg = "RS512";
      const jws = await getMockClientAssertion({
        customHeader: { alg: "RS512" },
        standardClaimsOverride: {},
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(algorithmNotAllowed(notAllowedAlg));
    });

    it("InvalidKidFormat", async () => {
      const jws = await getMockClientAssertion({
        customHeader: { kid: "not a valid kid" },
        standardClaimsOverride: {},
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidKidFormat());
    });
  });

  describe("verifyClientAssertionSignature", async () => {
    it("success client assertion signature", async () => {
      const threeHourLater = new Date();
      threeHourLater.setHours(threeHourLater.getHours() + 3);

      const keySet = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });

      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {
          iat: new Date().getTime() / 1000,
          exp: threeHourLater.getTime() / 1000,
        },
        customClaims: {},
        keySet,
      });
      const publicKey = keySet.publicKey
        .export({
          type: "spki",
          format: "pem",
        })
        .toString();
      const mockConsumerKey = {
        ...getMockConsumerKey(),
        publicKey,
      };
      const { errors } = await verifyClientAssertionSignature(
        jws,
        mockConsumerKey
      );
      expect(errors).toBeUndefined();
    });

    it("algorithmNotAllowed", async () => {
      const threeHourLater = new Date();
      threeHourLater.setHours(threeHourLater.getHours() + 3);

      const notAllowedAlg = "RS384";
      const keySet = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });

      const jws = await getMockClientAssertion({
        customHeader: {
          alg: notAllowedAlg,
        },
        standardClaimsOverride: {
          iat: new Date().getTime() / 1000,
          exp: threeHourLater.getTime() / 1000,
        },
        customClaims: {},
        keySet,
      });
      const publicKey = keySet.publicKey
        .export({
          type: "spki",
          format: "pem",
        })
        .toString();
      const mockConsumerKey: ConsumerKey = {
        ...getMockConsumerKey(),
        publicKey,
        algorithm: notAllowedAlg,
      };
      const { errors } = await verifyClientAssertionSignature(
        jws,
        mockConsumerKey
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(algorithmNotAllowed(notAllowedAlg));
    });

    it("tokenExpiredError", async () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const threeHourAgo = new Date();
      threeHourAgo.setHours(threeHourAgo.getHours() - 3);

      const keySet = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });

      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {
          iat: sixHoursAgo.getTime() / 1000,
          exp: threeHourAgo.getTime() / 1000,
        },
        customClaims: {},
        keySet,
      });
      const publicKey = keySet.publicKey
        .export({
          type: "spki",
          format: "pem",
        })
        .toString();
      const mockConsumerKey = {
        ...getMockConsumerKey(),
        publicKey,
      };
      const { errors } = await verifyClientAssertionSignature(
        jws,
        mockConsumerKey
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(tokenExpiredError());
    });
    it("jsonWebTokenError", async () => {
      const keySet = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });
      const publicKey = keySet.publicKey
        .export({
          type: "spki",
          format: "pem",
        })
        .toString();
      const mockConsumerKey = {
        ...getMockConsumerKey(),
        publicKey,
      };
      const { errors } = await verifyClientAssertionSignature(
        "not-a-valid-jws",
        mockConsumerKey
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(jsonWebTokenError("").code);
    });

    it("invalidSignature", async () => {
      const keySet = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });
      const publicKey = keySet.publicKey
        .export({
          type: "spki",
          format: "pem",
        })
        .toString();
      const mockConsumerKey = {
        ...getMockConsumerKey(),
        publicKey,
      };
      const clientAssertion = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {},
        keySet,
      });

      const subStrings = clientAssertion.split(".");
      const clientAssertionWithWrongSignature = `${subStrings[0]}.${subStrings[1]}.wrong-signature`;
      const { errors } = await verifyClientAssertionSignature(
        clientAssertionWithWrongSignature,
        mockConsumerKey
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidSignature());
    });
    it("jsonWebTokenError - malformed jwt", async () => {
      const keySet = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });
      const publicKey = keySet.publicKey
        .export({
          type: "spki",
          format: "pem",
        })
        .toString();
      const mockConsumerKey = {
        ...getMockConsumerKey(),
        publicKey,
      };
      const { errors } = await verifyClientAssertionSignature(
        "too.many.substrings.in.client.assertion",
        mockConsumerKey
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(jsonWebTokenError("").code);
    });

    it("correctly formatted signature but invalid", async () => {
      const keySet = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });

      const clientAssertion1 = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {},
        keySet,
      });

      const publicKey = keySet.publicKey
        .export({
          type: "spki",
          format: "pem",
        })
        .toString();
      const mockConsumerKey = {
        ...getMockConsumerKey(),
        publicKey,
      };

      const clientAssertion2 = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {},
        customClaims: {},
      });
      const subStrings1 = clientAssertion1.split(".");
      const subStrings2 = clientAssertion2.split(".");

      const clientAssertionWithWrongSignature = `${subStrings1[0]}.${subStrings1[1]}.${subStrings2[2]}`;
      const { errors } = await verifyClientAssertionSignature(
        clientAssertionWithWrongSignature,
        mockConsumerKey
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidSignature());
    });

    it("notBeforeError", async () => {
      const threeHoursAgo = new Date();
      threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);

      const threeHoursLater = new Date();
      threeHoursLater.setHours(threeHoursLater.getHours() + 3);

      const sixHoursLater = new Date();
      sixHoursLater.setHours(sixHoursLater.getHours() + 6);

      const keySet = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });
      const jws = await getMockClientAssertion({
        customHeader: {},
        standardClaimsOverride: {
          iat: threeHoursAgo.getTime() / 1000,
          exp: sixHoursLater.getTime() / 1000,
          nbf: threeHoursLater.getTime() / 1000,
        },
        customClaims: {},
        keySet,
      });
      const publicKey = keySet.publicKey.export({
        type: "spki",
        format: "pem",
      }) as string;
      const mockConsumerKey = {
        ...getMockConsumerKey(),
        publicKey,
      };

      const { errors } = await verifyClientAssertionSignature(
        jws,
        mockConsumerKey
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(notBeforeError());
    });
    it.skip("unexpectedClientAssertionSignatureVerificationError", async () => {
      // not sure when this happens
      expect(1).toBe(1);
    });
  });

  describe("validatePlatformState", async () => {
    it("success", async () => {
      const mockKey: ConsumerKey = {
        ...getMockConsumerKey(),
        agreementState: itemState.active,
        descriptorState: itemState.active,
        purposeState: itemState.active,
      };
      validatePlatformState(mockKey);
      const { errors } = validatePlatformState(mockKey);
      expect(errors).toBeUndefined();
    });

    it("inactiveAgreement", async () => {
      const mockKey: ConsumerKey = {
        ...getMockConsumerKey(),
        agreementState: itemState.inactive,
      };
      validatePlatformState(mockKey);
      const { errors } = validatePlatformState(mockKey);

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(inactiveAgreement());
    });
    it("inactiveEservice", async () => {
      const mockKey: ConsumerKey = {
        ...getMockConsumerKey(),
        descriptorState: itemState.inactive,
      };
      validatePlatformState(mockKey);
      const { errors } = validatePlatformState(mockKey);

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(inactiveEService());
    });
    it("inactivePurpose", async () => {
      const mockKey: ConsumerKey = {
        ...getMockConsumerKey(),
        purposeState: itemState.inactive,
      };
      validatePlatformState(mockKey);
      const { errors } = validatePlatformState(mockKey);

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(inactivePurpose());
    });
    it("inactiveAgreement and inactiveEservice and inactivePurpose", async () => {
      const mockKey: ConsumerKey = {
        ...getMockConsumerKey(),
        agreementState: itemState.inactive,
        descriptorState: itemState.inactive,
        purposeState: itemState.inactive,
      };
      validatePlatformState(mockKey);
      const { errors } = validatePlatformState(mockKey);

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(3);
      expect(errors).toEqual([
        inactiveAgreement(),
        inactiveEService(),
        inactivePurpose(),
      ]);
    });
  });

  describe("validateClientKindAndPlatformState", async () => {
    it("success (consumerKey with consumer client kind; valid platform states)", async () => {
      const mockConsumerKey = getMockConsumerKey();
      const { data: mockClientAssertion } = verifyClientAssertion(
        await getMockClientAssertion({
          customHeader: {},
          standardClaimsOverride: { purposeId: generateId<PurposeId>() },
          customClaims: {},
        }),
        undefined
      );
      if (!mockClientAssertion) {
        fail();
      }
      const { errors } = validateClientKindAndPlatformState(
        mockConsumerKey,
        mockClientAssertion
      );
      expect(errors).toBeUndefined();
    });

    it("inactiveEService (consumerKey with consumer client kind; invalid platform states)", async () => {
      const mockConsumerKey: ConsumerKey = {
        ...getMockConsumerKey(),
        descriptorState: itemState.inactive,
      };
      const { data: mockClientAssertion } = verifyClientAssertion(
        await getMockClientAssertion({
          customHeader: {},
          standardClaimsOverride: { purposeId: generateId<PurposeId>() },
          customClaims: {},
        }),
        undefined
      );
      if (!mockClientAssertion) {
        fail();
      }
      const { errors } = validateClientKindAndPlatformState(
        mockConsumerKey,
        mockClientAssertion
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(inactiveEService());
    });

    it("success (apiKey with api client kind)", async () => {
      const mockApiKey = getMockApiKey();
      const { data: mockClientAssertion } = verifyClientAssertion(
        await getMockClientAssertion({
          customHeader: {},
          standardClaimsOverride: {},
          customClaims: {},
        }),
        undefined
      );
      if (!mockClientAssertion) {
        fail();
      }
      const { errors } = validateClientKindAndPlatformState(
        mockApiKey,
        mockClientAssertion
      );
      expect(errors).toBeUndefined();
    });

    it("purposeIdNotProvided for Client Kind Consumer", async () => {
      const mockConsumerKey = getMockConsumerKey();
      const { data: mockClientAssertion } = verifyClientAssertion(
        await getMockClientAssertion({
          customHeader: {},
          standardClaimsOverride: { purposeId: undefined },
          customClaims: {},
        }),
        undefined
      );
      if (!mockClientAssertion) {
        fail();
      }
      const { errors } = validateClientKindAndPlatformState(
        mockConsumerKey,
        mockClientAssertion
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(purposeIdNotProvided());
    });

    it("purposeIdNotProvided and platformStateError", async () => {
      const mockConsumerKey: ConsumerKey = {
        ...getMockConsumerKey(),
        agreementState: itemState.inactive,
      };
      const { data: mockClientAssertion } = verifyClientAssertion(
        await getMockClientAssertion({
          customHeader: {},
          standardClaimsOverride: { purposeId: undefined },
          customClaims: {},
        }),
        undefined
      );
      if (!mockClientAssertion) {
        fail();
      }
      const { errors } = validateClientKindAndPlatformState(
        mockConsumerKey,
        mockClientAssertion
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(2);
      expect(errors).toEqual([inactiveAgreement(), purposeIdNotProvided()]);
    });
  });
});
