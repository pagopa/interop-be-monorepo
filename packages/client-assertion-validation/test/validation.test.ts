/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { fail } from "assert";
import { describe, expect, it } from "vitest";
import {
  algorithm,
  ClientId,
  clientKindTokenGenStates,
  generateId,
  itemState,
  PurposeId,
  TokenGenerationStatesApiClient,
  TokenGenerationStatesConsumerClient,
} from "pagopa-interop-models";
import * as jsonwebtoken from "jsonwebtoken";
import {
  generateKeySet,
  getMockClientAssertion,
  getMockTokenGenStatesApiClient,
  getMockTokenGenStatesConsumerClient,
} from "pagopa-interop-commons-test";
import { dateToSeconds, genericLogger } from "pagopa-interop-commons";
import {
  validateClientKindAndPlatformState,
  validateRequestParameters,
  verifyClientAssertion,
  verifyClientAssertionSignature,
} from "../src/validation.js";
import { validateAudience, validatePlatformState } from "../src/utils.js";
import {
  algorithmNotAllowed,
  algorithmNotFound,
  invalidDigestClaim,
  expNotFound,
  invalidEServiceState,
  invalidAgreementState,
  invalidPurposeState,
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
  unexpectedClientAssertionSignatureVerificationError,
  audienceNotFound,
} from "../src/errors.js";
import { ClientAssertionValidationRequest } from "../src/types.js";
import {
  expectedAudiences,
  getMockAccessTokenRequest,
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
      const { jws } = await getMockClientAssertion();
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeUndefined();
    });

    it("clientAssertionInvalidClaims - header", async () => {
      const { jws } = await getMockClientAssertion({
        customHeader: {
          invalidHeaderProp: "wrong",
        },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger,
        true
      );

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(
        clientAssertionInvalidClaims("{}", "header").code
      );
    });

    // TODO: remove this test when we will only accept valid client assertion claims
    it("ignore unexpected claims in client assertion header", async () => {
      const { jws } = await getMockClientAssertion({
        customHeader: {
          invalidHeaderProp: "wrong",
        },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );

      expect(errors).toBeUndefined();
    });

    it("clientAssertionInvalidClaims - payload", async () => {
      const { jws } = await getMockClientAssertion({
        customClaims: {
          wrongPayloadProp: "wrong",
        },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger,
        true
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(
        clientAssertionInvalidClaims("{}", "payload").code
      );
    });

    it("ignore unexpected claims in client assertion payload", async () => {
      const { jws } = await getMockClientAssertion({
        customClaims: {
          wrongPayloadProp: "wrong",
        },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeUndefined();
    });

    it("wrong signature", async () => {
      const { jws } = await getMockClientAssertion();
      const subStrings = jws.split(".");
      const clientAssertionWithWrongSignature = `${subStrings[0]}.${subStrings[1]}.wrong-signature`;
      const { errors } = verifyClientAssertion(
        clientAssertionWithWrongSignature,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeUndefined();
    });

    it("correctly formatted but invalid signature", async () => {
      const { jws: clientAssertion1 } = await getMockClientAssertion();
      const { jws: clientAssertion2 } = await getMockClientAssertion();
      const subStrings1 = clientAssertion1.split(".");
      const subStrings2 = clientAssertion2.split(".");

      const clientAssertionWithWrongSignature = `${subStrings1[0]}.${subStrings1[1]}.${subStrings2[2]}`;
      const { errors } = verifyClientAssertion(
        clientAssertionWithWrongSignature,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeUndefined();
    });

    it("invalidClientAssertionFormat (malformed jwt)", async () => {
      const { errors: errors1 } = verifyClientAssertion(
        "too.many.substrings.in.client.assertion",
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors1).toBeDefined();
      expect(errors1).toHaveLength(1);
      expect(errors1![0]).toEqual(invalidClientAssertionFormat("Invalid JWT"));

      const { errors: errors2 } = verifyClientAssertion(
        "not a jwt",
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors2).toBeDefined();
      expect(errors2).toHaveLength(1);
      expect(errors2![0]).toEqual(invalidClientAssertionFormat("Invalid JWT"));

      const { errors: errors3 } = verifyClientAssertion(
        "not.a.jwt",
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors3).toBeDefined();
      expect(errors3).toHaveLength(1);
      expect(errors3![0]).toEqual(
        invalidClientAssertionFormat(
          "Failed to parse the decoded payload as JSON"
        )
      );

      const { errors: errors4 } = verifyClientAssertion(
        "signature.missing",
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors4).toBeDefined();
      expect(errors4).toHaveLength(1);
      expect(errors4![0]).toEqual(invalidClientAssertionFormat("Invalid JWT"));
    });

    it("invalidAudience - wrong entry as string", async () => {
      const aud = "random";
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { aud },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudience(aud));
    });

    it("invalidAudience - wrong entry as 1-item array", async () => {
      const aud = ["random"];
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { aud },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudience(aud));
    });

    it("invalidAudience - wrong entries", async () => {
      const aud = ["wrong-audience1", "wrong-audience2"];
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { aud },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudience(aud));
    });

    it("unexpectedClientAssertionPayload", async () => {
      const { keySet } = generateKeySet();
      const options: jsonwebtoken.SignOptions = {
        header: {
          kid: generateId(),
          alg: algorithm.RS256,
        },
      };
      const jws = jsonwebtoken.sign(
        "actualPayload",
        keySet.privateKey,
        options
      );

      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(
        invalidClientAssertionFormat(
          "Failed to parse the decoded payload as JSON"
        )
      );
    });

    it("jtiNotFound", async () => {
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { jti: undefined },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(jtiNotFound());
    });

    it("iatNotFound", async () => {
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: {
          iat: undefined,
        },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(issuedAtNotFound());
    });

    it("expNotFound", async () => {
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: {
          exp: undefined,
        },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(expNotFound());
    });

    it("issuerNotFound", async () => {
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { iss: undefined },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(issuerNotFound());
    });

    it("jtiNotFound and issuerNotFound", async () => {
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { jti: undefined, iss: undefined },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(2);
      expect(errors).toEqual([jtiNotFound(), issuerNotFound()]);
    });

    it("subjectNotFound", async () => {
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { sub: undefined },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(subjectNotFound());
    });

    it("invalidSubject - Subject claim differs from clientID parameter", async () => {
      const subject = generateId<ClientId>();
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { sub: subject },
      });
      const { errors } = verifyClientAssertion(
        jws,
        generateId<ClientId>(),
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidSubject(subject));
    });

    it("invalidSubjectFormat", async () => {
      const clientId: ClientId = generateId();
      const subject = "not a client id";
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { sub: subject },
      });
      const { errors } = verifyClientAssertion(
        jws,
        clientId,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidSubjectFormat(subject));
    });

    it("invalidPurposeIdClaimFormat", async () => {
      const notPurposeId = "not a purpose id";
      const { jws } = await getMockClientAssertion({
        customClaims: {
          purposeId: notPurposeId,
        },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidPurposeIdClaimFormat(notPurposeId));
    });

    it("invalidClientIdFormat", async () => {
      const notClientId = "not a client id";
      const { jws } = await getMockClientAssertion();
      const { errors } = verifyClientAssertion(
        jws,
        notClientId,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidClientIdFormat(notClientId));
    });

    it("should not throw error if digest is undefined", async () => {
      const { jws } = await getMockClientAssertion({
        customClaims: {
          digest: undefined,
        },
      });

      const verifiedClientAssertion = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(verifiedClientAssertion.errors).toBeUndefined();
      expect(verifiedClientAssertion.data?.payload.digest).toBeUndefined();
    });

    it("should not throw error if digest is null", async () => {
      const { jws } = await getMockClientAssertion({
        customClaims: {
          digest: null,
        },
      });

      const verifiedClientAssertion = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(verifiedClientAssertion.errors).toBeUndefined();
      expect(verifiedClientAssertion.data?.payload.digest).toBeUndefined();
    });

    it("invalidDigestClaim", async () => {
      const { jws } = await getMockClientAssertion({
        customClaims: { digest: { alg: "alg", invalidProp: true } },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(invalidDigestClaim("").code);
    });

    it("invalidHashLength", async () => {
      const { jws } = await getMockClientAssertion({
        customClaims: {
          digest: { alg: "SHA256", value: "string of wrong length" },
        },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidHashLength("SHA256"));
    });

    it("InvalidHashAlgorithm", async () => {
      const { jws } = await getMockClientAssertion({
        customClaims: {
          digest: { alg: "wrong alg", value: value64chars },
        },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidHashAlgorithm());
    });

    it("invalidHashLength and invalidHashAlgorithm", async () => {
      const { jws } = await getMockClientAssertion({
        customClaims: {
          digest: { alg: "wrong alg", value: "string of wrong length" },
        },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(2);
      expect(errors).toEqual([
        invalidHashLength("wrong alg"),
        invalidHashAlgorithm(),
      ]);
    });

    it.skip("AlgorithmNotFound", async () => {
      // it seems this can't be tested because we need alg header to sign the mock jwt
      const { jws } = await getMockClientAssertion({
        customHeader: { alg: undefined },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(algorithmNotFound());
    });

    it("AlgorithmNotAllowed", async () => {
      const notAllowedAlg = "RS512";
      const { jws } = await getMockClientAssertion({
        customHeader: { alg: "RS512" },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(algorithmNotAllowed(notAllowedAlg));
    });

    it("InvalidKidFormat", async () => {
      const { jws } = await getMockClientAssertion({
        customHeader: { kid: "not a valid kid" },
      });
      const { errors } = verifyClientAssertion(
        jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidKidFormat());
    });
  });

  describe("verifyClientAssertionSignature", async () => {
    it("success client assertion signature", async () => {
      const threeHourLater = new Date();
      threeHourLater.setHours(threeHourLater.getHours() + 3);

      const { jws, publicKeyEncodedPem } = await getMockClientAssertion({
        standardClaimsOverride: {
          iat: dateToSeconds(new Date()),
          exp: dateToSeconds(threeHourLater),
        },
      });
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        publicKey: publicKeyEncodedPem,
      };
      const { errors } = await verifyClientAssertionSignature(
        jws,
        mockKey,
        algorithm.RS256
      );
      expect(errors).toBeUndefined();
    });

    it("unexpectedClientAssertionSignatureVerificationError - base64 key expected", async () => {
      const { jws, publicKeyEncodedPem } = await getMockClientAssertion();

      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        publicKey: Buffer.from(publicKeyEncodedPem, "base64").toString("utf8"),
      };

      const { errors } = await verifyClientAssertionSignature(
        jws,
        mockKey,
        algorithm.RS256
      );
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(
        unexpectedClientAssertionSignatureVerificationError(
          "public key shall be a base64 encoded PEM"
        )
      );
    });

    it("algorithmNotAllowed", async () => {
      const threeHourLater = new Date();
      threeHourLater.setHours(threeHourLater.getHours() + 3);

      const notAllowedAlg = "RS384";

      const { jws, publicKeyEncodedPem } = await getMockClientAssertion({
        customHeader: {
          alg: notAllowedAlg,
        },
        standardClaimsOverride: {
          iat: dateToSeconds(new Date()),
          exp: dateToSeconds(threeHourLater),
        },
      });
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        publicKey: publicKeyEncodedPem,
      };

      const { errors } = await verifyClientAssertionSignature(
        jws,
        mockKey,
        notAllowedAlg
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

      const { jws, publicKeyEncodedPem } = await getMockClientAssertion({
        standardClaimsOverride: {
          iat: dateToSeconds(sixHoursAgo),
          exp: dateToSeconds(threeHourAgo),
        },
      });

      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        publicKey: publicKeyEncodedPem,
      };
      const { errors } = await verifyClientAssertionSignature(
        jws,
        mockKey,
        algorithm.RS256
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(tokenExpiredError());
    });
    it("jsonWebTokenError", async () => {
      const { publicKeyEncodedPem } = generateKeySet();
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        publicKey: publicKeyEncodedPem,
      };

      const { errors } = await verifyClientAssertionSignature(
        "not-a-valid-jws",
        mockKey,
        algorithm.RS256
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(jsonWebTokenError("").code);
    });

    it("invalidSignature", async () => {
      const { publicKeyEncodedPem } = generateKeySet();
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        publicKey: publicKeyEncodedPem,
      };

      const { jws } = await getMockClientAssertion();

      const subStrings = jws.split(".");
      const clientAssertionWithWrongSignature = `${subStrings[0]}.${subStrings[1]}.wrong-signature`;
      const { errors } = await verifyClientAssertionSignature(
        clientAssertionWithWrongSignature,
        mockKey,
        algorithm.RS256
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidSignature());
    });
    it("jsonWebTokenError - malformed jwt", async () => {
      const { publicKeyEncodedPem } = generateKeySet();
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        publicKey: publicKeyEncodedPem,
      };

      const { errors } = await verifyClientAssertionSignature(
        "too.many.substrings.in.client.assertion",
        mockKey,
        algorithm.RS256
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(jsonWebTokenError("").code);
    });

    it("correctly formatted signature but invalid", async () => {
      const { jws: clientAssertion1, publicKeyEncodedPem } =
        await getMockClientAssertion();

      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        publicKey: publicKeyEncodedPem,
      };

      const { jws: clientAssertion2 } = await getMockClientAssertion();
      const subStrings1 = clientAssertion1.split(".");
      const subStrings2 = clientAssertion2.split(".");

      const clientAssertionWithWrongSignature = `${subStrings1[0]}.${subStrings1[1]}.${subStrings2[2]}`;
      const { errors } = await verifyClientAssertionSignature(
        clientAssertionWithWrongSignature,
        mockKey,
        algorithm.RS256
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

      const { jws, publicKeyEncodedPem } = await getMockClientAssertion({
        standardClaimsOverride: {
          iat: dateToSeconds(threeHoursAgo),
          exp: dateToSeconds(sixHoursLater),
          nbf: dateToSeconds(threeHoursLater),
        },
      });
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        publicKey: publicKeyEncodedPem,
      };

      const { errors } = await verifyClientAssertionSignature(
        jws,
        mockKey,
        algorithm.RS256
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
      const mockKey = getMockTokenGenStatesConsumerClient();
      validatePlatformState(mockKey);
      const { errors } = validatePlatformState(mockKey);
      expect(errors).toBeUndefined();
    });

    it("invalidAgreementState", async () => {
      const agreementState = itemState.inactive;
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        agreementState,
      };
      validatePlatformState(mockKey);
      const { errors } = validatePlatformState(mockKey);

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAgreementState(agreementState));
    });
    it("invalidEServiceState", async () => {
      const descriptorState = itemState.inactive;
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        descriptorState,
        descriptorAudience: ["test.interop.pagopa.it"],
        descriptorVoucherLifespan: 60,
      };
      validatePlatformState(mockKey);
      const { errors } = validatePlatformState(mockKey);

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidEServiceState(descriptorState));
    });
    it("invalidPurposeState", async () => {
      const purposeState = itemState.inactive;
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        purposeState,
      };

      validatePlatformState(mockKey);
      const { errors } = validatePlatformState(mockKey);

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidPurposeState(purposeState));
    });
    it("invalidAgreementState and invalidEServiceState and invalidPurposeState", async () => {
      const agreementState = itemState.inactive;
      const descriptorState = itemState.inactive;
      const purposeState = itemState.inactive;
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        agreementState,
        descriptorState,
        purposeState,
      };
      validatePlatformState(mockKey);
      const { errors } = validatePlatformState(mockKey);

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(3);
      expect(errors).toEqual([
        invalidAgreementState(agreementState),
        invalidEServiceState(descriptorState),
        invalidPurposeState(purposeState),
      ]);
    });
  });

  describe("validateClientKindAndPlatformState", async () => {
    it("success (clientKidPurpose entry with consumer client kind; valid platform states)", async () => {
      const mockConsumerKey = getMockTokenGenStatesConsumerClient();
      const { data: mockClientAssertion } = verifyClientAssertion(
        (
          await getMockClientAssertion({
            standardClaimsOverride: { purposeId: generateId<PurposeId>() },
          })
        ).jws,
        undefined,
        expectedAudiences,
        genericLogger
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

    it("invalidEServiceState (consumerKey with consumer client kind; invalid platform states)", async () => {
      const descriptorState = itemState.inactive;
      const mockConsumerKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        descriptorState,
      };
      const { data: mockClientAssertion } = verifyClientAssertion(
        (
          await getMockClientAssertion({
            standardClaimsOverride: { purposeId: generateId<PurposeId>() },
          })
        ).jws,
        undefined,
        expectedAudiences,
        genericLogger
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
      expect(errors![0]).toEqual(invalidEServiceState(descriptorState));
    });

    it("success (clientEntry with api client kind)", async () => {
      const mockApiKey: TokenGenerationStatesApiClient = {
        ...getMockTokenGenStatesApiClient(),
        clientKind: clientKindTokenGenStates.api,
      };
      const { data: mockClientAssertion } = verifyClientAssertion(
        (await getMockClientAssertion()).jws,
        undefined,
        expectedAudiences,
        genericLogger
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

    it("invalidPurposeState for consumer client", async () => {
      const mockConsumerClient: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        clientKind: clientKindTokenGenStates.consumer,
        agreementState: itemState.active,
        descriptorState: itemState.active,
        purposeState: undefined,
      };
      const { data: mockClientAssertion } = verifyClientAssertion(
        (
          await getMockClientAssertion({
            customClaims: { purposeId: mockConsumerClient.GSIPK_purposeId },
          })
        ).jws,
        undefined,
        expectedAudiences,
        genericLogger
      );
      if (!mockClientAssertion) {
        fail();
      }
      const { errors } = validateClientKindAndPlatformState(
        mockConsumerClient,
        mockClientAssertion
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors).toEqual([
        invalidPurposeState(mockConsumerClient.purposeState),
      ]);
    });

    it("purposeIdNotProvided for Client Kind Consumer", async () => {
      const mockConsumerKey = getMockTokenGenStatesConsumerClient();
      const { data: mockClientAssertion } = verifyClientAssertion(
        (
          await getMockClientAssertion({
            standardClaimsOverride: { purposeId: undefined },
          })
        ).jws,
        undefined,
        expectedAudiences,
        genericLogger
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
      const agreementState = itemState.inactive;
      const mockConsumerKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenGenStatesConsumerClient(),
        agreementState,
      };
      const { data: mockClientAssertion } = verifyClientAssertion(
        (
          await getMockClientAssertion({
            standardClaimsOverride: { purposeId: undefined },
          })
        ).jws,
        undefined,
        expectedAudiences,
        genericLogger
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
      expect(errors).toEqual([
        invalidAgreementState(agreementState),
        purposeIdNotProvided(),
      ]);
    });
  });

  describe("validateAudience", () => {
    describe("expectedAudiences is a one item array", () => {
      it("should succeed if the expected audiences contain the received audience (string)", () => {
        const receivedAudiences = "aud1";
        const expectedAudiences = ["aud1"];
        expect(
          validateAudience(receivedAudiences, expectedAudiences)
        ).toMatchObject({
          data: receivedAudiences,
          errors: undefined,
        });
      });

      it("should return error if the expected audiences don't contain the received audience (string)", () => {
        const receivedAudiences = "aud2";
        const expectedAudiences = ["aud1"];
        expect(
          validateAudience(receivedAudiences, expectedAudiences)
        ).toMatchObject({
          data: undefined,
          errors: [invalidAudience(receivedAudiences)],
        });
      });

      it("should return error if the received audience is undefined", () => {
        const receivedAudiences = undefined;
        const expectedAudiences = ["aud1"];
        expect(
          validateAudience(receivedAudiences, expectedAudiences)
        ).toMatchObject({
          data: undefined,
          errors: [audienceNotFound()],
        });
      });

      it("should return error if the expected audiences don't contain the received audience (comma separated string)", () => {
        const receivedAudiences = "aud1, aud2";
        const expectedAudiences = ["aud1"];
        expect(
          validateAudience(receivedAudiences, expectedAudiences)
        ).toMatchObject({
          data: undefined,
          errors: [invalidAudience(receivedAudiences)],
        });
      });

      it("should return error if the intersection between the expected audiences and the received audiences is empty (array)", () => {
        const receivedAudiences = ["aud2"];
        const expectedAudiences = ["aud1"];
        expect(
          validateAudience(receivedAudiences, expectedAudiences)
        ).toMatchObject({
          data: undefined,
          errors: [invalidAudience(receivedAudiences)],
        });
      });

      it("should succeed if the intersection between the expected audiences and the received audiences is not empty (array)", () => {
        const receivedAudiences = ["aud1", "aud2"];
        const expectedAudiences = ["aud1"];
        expect(
          validateAudience(receivedAudiences, expectedAudiences)
        ).toMatchObject({
          data: receivedAudiences,
          errors: undefined,
        });
      });
    });

    describe("expectedAudiences is a two items array", () => {
      it("should succeed if the expected audiences contain the received audience (string)", () => {
        const receivedAudiences = "aud1";
        const expectedAudiences = ["aud1", "aud2"];
        expect(
          validateAudience(receivedAudiences, expectedAudiences)
        ).toMatchObject({
          data: receivedAudiences,
          errors: undefined,
        });
      });

      it("should return error if the expected audiences don't contain the received audience (string)", () => {
        const receivedAudiences = "aud3";
        const expectedAudiences = ["aud1", "aud2"];
        expect(
          validateAudience(receivedAudiences, expectedAudiences)
        ).toMatchObject({
          data: undefined,
          errors: [invalidAudience(receivedAudiences)],
        });
      });

      it("should return error if the expected audiences don't contain the received audience (comma separated string)", () => {
        const receivedAudiences = "aud1, aud2";
        const expectedAudiences = ["aud1", "aud2"];
        expect(
          validateAudience(receivedAudiences, expectedAudiences)
        ).toMatchObject({
          data: undefined,
          errors: [invalidAudience(receivedAudiences)],
        });
      });

      it("should succeed if the expected audiences contain the received audiences (array)", () => {
        const receivedAudiences = ["aud1"];
        const expectedAudiences = ["aud1", "aud2"];
        expect(
          validateAudience(receivedAudiences, expectedAudiences)
        ).toMatchObject({
          data: receivedAudiences,
          errors: undefined,
        });
      });

      it("should return error if the intersection between the expected audiences and the received audiences (array) is empty", () => {
        const receivedAudiences = ["aud3"];
        const expectedAudiences = ["aud1", "aud2"];
        expect(
          validateAudience(receivedAudiences, expectedAudiences)
        ).toMatchObject({
          data: undefined,
          errors: [invalidAudience(receivedAudiences)],
        });
      });

      it("should succeed if the expected audiences match the received audiences (array)", () => {
        const receivedAudiences = ["aud1", "aud2"];
        const expectedAudiences = ["aud1", "aud2"];
        expect(
          validateAudience(receivedAudiences, expectedAudiences)
        ).toMatchObject({
          data: receivedAudiences,
          errors: undefined,
        });
      });

      it("should succeed if the intersection between the expected audiences and the received audiences (array) is not empty", () => {
        const receivedAudiences = ["aud1", "aud3"];
        const expectedAudiences = ["aud1", "aud2"];
        expect(
          validateAudience(receivedAudiences, expectedAudiences)
        ).toMatchObject({
          data: receivedAudiences,
          errors: undefined,
        });
      });
    });
  });
});
