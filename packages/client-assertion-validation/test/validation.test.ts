/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { fail } from "assert";
import { describe, expect, it } from "vitest";
import {
  ClientId,
  clientKindTokenStates,
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
  getMockTokenStatesClientEntry,
  getMockTokenStatesClientPurposeEntry,
} from "pagopa-interop-commons-test";
import { dateToSeconds } from "pagopa-interop-commons";
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
  invalidAudienceFormat,
  unexpectedClientAssertionSignatureVerificationError,
} from "../src/errors.js";
import { ClientAssertionValidationRequest } from "../src/types.js";
import { getMockAccessTokenRequest, value64chars } from "./utils.js";

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
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeUndefined();
    });

    it("clientAssertionInvalidClaims - header", async () => {
      const { jws } = await getMockClientAssertion({
        customHeader: {
          invalidHeaderProp: "wrong",
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(clientAssertionInvalidClaims("").code);
    });

    it("clientAssertionInvalidClaims - payload", async () => {
      const { jws } = await getMockClientAssertion({
        customClaims: {
          wrongPayloadProp: "wrong",
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(clientAssertionInvalidClaims("").code);
    });

    it("wrong signature", async () => {
      const { jws } = await getMockClientAssertion();
      const subStrings = jws.split(".");
      const clientAssertionWithWrongSignature = `${subStrings[0]}.${subStrings[1]}.wrong-signature`;
      const { errors } = verifyClientAssertion(
        clientAssertionWithWrongSignature,
        undefined
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
      expect(errors1![0]).toEqual(invalidClientAssertionFormat("Invalid JWT"));

      const { errors: errors2 } = verifyClientAssertion("not a jwt", undefined);
      expect(errors2).toBeDefined();
      expect(errors2).toHaveLength(1);
      expect(errors2![0]).toEqual(invalidClientAssertionFormat("Invalid JWT"));

      const { errors: errors3 } = verifyClientAssertion("not.a.jwt", undefined);
      expect(errors3).toBeDefined();
      expect(errors3).toHaveLength(1);
      expect(errors3![0]).toEqual(
        invalidClientAssertionFormat(
          "Failed to parse the decoded payload as JSON"
        )
      );

      const { errors: errors4 } = verifyClientAssertion(
        "signature.missing",
        undefined
      );
      expect(errors4).toBeDefined();
      expect(errors4).toHaveLength(1);
      expect(errors4![0]).toEqual(invalidClientAssertionFormat("Invalid JWT"));
    });

    it("invalidAudience - wrong entry as string", async () => {
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { aud: "random" },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudience());
    });

    it("invalidAudience - wrong entry as 1-item array", async () => {
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { aud: ["random"] },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudience());
    });

    it("invalidAudienceFormat - comma-separated strings", async () => {
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { aud: "test.interop.pagopa.it, other-aud" },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudienceFormat());
    });

    it("invalidAudience - wrong entries", async () => {
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { aud: ["wrong-audience1, wrong-audience2"] },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudience());
    });

    it("invalidAudience - missing entry", async () => {
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: {
          aud: ["test.interop.pagopa.it"],
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudience());
    });

    it("unexpectedClientAssertionPayload", async () => {
      const { keySet } = generateKeySet();
      const options: jsonwebtoken.SignOptions = {
        header: {
          kid: generateId(),
          alg: "RS256",
        },
      };
      const jws = jsonwebtoken.sign(
        "actualPayload",
        keySet.privateKey,
        options
      );

      const { errors } = verifyClientAssertion(jws, undefined);

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
      const { errors } = verifyClientAssertion(jws, undefined);
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
      const { errors } = verifyClientAssertion(jws, undefined);
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
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(expNotFound());
    });

    it("issuerNotFound", async () => {
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { iss: undefined },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(issuerNotFound());
    });

    it("jtiNotFound and issuerNotFound", async () => {
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { jti: undefined, iss: undefined },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(2);
      expect(errors).toEqual([jtiNotFound(), issuerNotFound()]);
    });

    it("subjectNotFound", async () => {
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { sub: undefined },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(subjectNotFound());
    });

    it("invalidSubject - Subject claim differs from clientID parameter", async () => {
      const subject = generateId<ClientId>();
      const { jws } = await getMockClientAssertion({
        standardClaimsOverride: { sub: subject },
      });
      const { errors } = verifyClientAssertion(jws, generateId<ClientId>());
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
      const { errors } = verifyClientAssertion(jws, clientId);
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
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidPurposeIdClaimFormat(notPurposeId));
    });

    it("invalidClientIdFormat", async () => {
      const notClientId = "not a client id";
      const { jws } = await getMockClientAssertion();
      const { errors } = verifyClientAssertion(jws, notClientId);
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

      const verifiedClientAssertion = verifyClientAssertion(jws, undefined);
      expect(verifiedClientAssertion.data?.payload.digest).toBeUndefined();
    });

    it("digestClaimNotFound", async () => {
      const { jws } = await getMockClientAssertion({
        customClaims: { digest: { alg: "alg", invalidProp: true } },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(digestClaimNotFound("").code);
    });

    it("invalidHashLength", async () => {
      const { jws } = await getMockClientAssertion({
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
      const { jws } = await getMockClientAssertion({
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
      const { jws } = await getMockClientAssertion({
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
      const { jws } = await getMockClientAssertion({
        customHeader: { alg: undefined },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(algorithmNotFound());
    });

    it("AlgorithmNotAllowed", async () => {
      const notAllowedAlg = "RS512";
      const { jws } = await getMockClientAssertion({
        customHeader: { alg: "RS512" },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(algorithmNotAllowed(notAllowedAlg));
    });

    it("InvalidKidFormat", async () => {
      const { jws } = await getMockClientAssertion({
        customHeader: { kid: "not a valid kid" },
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

      const { jws, publicKeyEncodedPem } = await getMockClientAssertion({
        standardClaimsOverride: {
          iat: dateToSeconds(new Date()),
          exp: dateToSeconds(threeHourLater),
        },
      });
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesClientPurposeEntry(),
        publicKey: publicKeyEncodedPem,
      };
      const { errors } = await verifyClientAssertionSignature(
        jws,
        mockKey,
        "RS256"
      );
      expect(errors).toBeUndefined();
    });

    it("unexpectedClientAssertionSignatureVerificationError - base64 key expected", async () => {
      const { jws, publicKeyEncodedPem } = await getMockClientAssertion();

      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesClientPurposeEntry(),
        publicKey: Buffer.from(publicKeyEncodedPem, "base64").toString("utf8"),
      };

      const { errors } = await verifyClientAssertionSignature(
        jws,
        mockKey,
        "RS256"
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
        ...getMockTokenStatesClientPurposeEntry(),
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
        ...getMockTokenStatesClientPurposeEntry(),
        publicKey: publicKeyEncodedPem,
      };
      const { errors } = await verifyClientAssertionSignature(
        jws,
        mockKey,
        "RS256"
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(tokenExpiredError());
    });
    it("jsonWebTokenError", async () => {
      const { publicKeyEncodedPem } = generateKeySet();
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesClientPurposeEntry(),
        publicKey: publicKeyEncodedPem,
      };

      const { errors } = await verifyClientAssertionSignature(
        "not-a-valid-jws",
        mockKey,
        "RS256"
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(jsonWebTokenError("").code);
    });

    it("invalidSignature", async () => {
      const { publicKeyEncodedPem } = generateKeySet();
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesClientPurposeEntry(),
        publicKey: publicKeyEncodedPem,
      };

      const { jws } = await getMockClientAssertion();

      const subStrings = jws.split(".");
      const clientAssertionWithWrongSignature = `${subStrings[0]}.${subStrings[1]}.wrong-signature`;
      const { errors } = await verifyClientAssertionSignature(
        clientAssertionWithWrongSignature,
        mockKey,
        "RS256"
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidSignature());
    });
    it("jsonWebTokenError - malformed jwt", async () => {
      const { publicKeyEncodedPem } = generateKeySet();
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesClientPurposeEntry(),
        publicKey: publicKeyEncodedPem,
      };

      const { errors } = await verifyClientAssertionSignature(
        "too.many.substrings.in.client.assertion",
        mockKey,
        "RS256"
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].code).toEqual(jsonWebTokenError("").code);
    });

    it("correctly formatted signature but invalid", async () => {
      const { jws: clientAssertion1, publicKeyEncodedPem } =
        await getMockClientAssertion();

      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesClientPurposeEntry(),
        publicKey: publicKeyEncodedPem,
      };

      const { jws: clientAssertion2 } = await getMockClientAssertion();
      const subStrings1 = clientAssertion1.split(".");
      const subStrings2 = clientAssertion2.split(".");

      const clientAssertionWithWrongSignature = `${subStrings1[0]}.${subStrings1[1]}.${subStrings2[2]}`;
      const { errors } = await verifyClientAssertionSignature(
        clientAssertionWithWrongSignature,
        mockKey,
        "RS256"
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
        ...getMockTokenStatesClientPurposeEntry(),
        publicKey: publicKeyEncodedPem,
      };

      const { errors } = await verifyClientAssertionSignature(
        jws,
        mockKey,
        "RS256"
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
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesClientPurposeEntry(),
      };
      validatePlatformState(mockKey);
      const { errors } = validatePlatformState(mockKey);
      expect(errors).toBeUndefined();
    });

    it("invalidAgreementState", async () => {
      const agreementState = itemState.inactive;
      const mockKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesClientPurposeEntry(),
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
        ...getMockTokenStatesClientPurposeEntry(),
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
        ...getMockTokenStatesClientPurposeEntry(),
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
        ...getMockTokenStatesClientPurposeEntry(),
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
      const mockConsumerKey = getMockTokenStatesClientPurposeEntry();
      const { data: mockClientAssertion } = verifyClientAssertion(
        (
          await getMockClientAssertion({
            standardClaimsOverride: { purposeId: generateId<PurposeId>() },
          })
        ).jws,
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

    it("invalidEServiceState (consumerKey with consumer client kind; invalid platform states)", async () => {
      const descriptorState = itemState.inactive;
      const mockConsumerKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesClientPurposeEntry(),
        descriptorState,
      };
      const { data: mockClientAssertion } = verifyClientAssertion(
        (
          await getMockClientAssertion({
            standardClaimsOverride: { purposeId: generateId<PurposeId>() },
          })
        ).jws,
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
      expect(errors![0]).toEqual(invalidEServiceState(descriptorState));
    });

    it("success (clientEntry with api client kind)", async () => {
      const mockApiKey: TokenGenerationStatesApiClient = {
        ...getMockTokenStatesClientEntry(),
        clientKind: clientKindTokenStates.api,
      };
      const { data: mockClientAssertion } = verifyClientAssertion(
        (await getMockClientAssertion()).jws,
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

    it("invalidPurposeState for consumer client", async () => {
      const mockConsumerClient: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesClientPurposeEntry(),
        clientKind: clientKindTokenStates.consumer,
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
        undefined
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
      const mockConsumerKey = getMockTokenStatesClientPurposeEntry();
      const { data: mockClientAssertion } = verifyClientAssertion(
        (
          await getMockClientAssertion({
            standardClaimsOverride: { purposeId: undefined },
          })
        ).jws,
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
      const agreementState = itemState.inactive;
      const mockConsumerKey: TokenGenerationStatesConsumerClient = {
        ...getMockTokenStatesClientPurposeEntry(),
        agreementState,
      };
      const { data: mockClientAssertion } = verifyClientAssertion(
        (
          await getMockClientAssertion({
            standardClaimsOverride: { purposeId: undefined },
          })
        ).jws,
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
      expect(errors).toEqual([
        invalidAgreementState(agreementState),
        purposeIdNotProvided(),
      ]);
    });
  });
});
