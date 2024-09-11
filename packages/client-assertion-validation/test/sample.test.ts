/* eslint-disable @typescript-eslint/no-non-null-assertion */
import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { ClientId, generateId, itemState } from "pagopa-interop-models";
import * as jwt from "jsonwebtoken";
import {
  assertValidPlatformState,
  verifyClientAssertion,
} from "../src/utils.js";
import {
  expNotFound,
  inactiveAgreement,
  inactiveEService,
  inactivePurpose,
  invalidAudience,
  invalidAudienceFormat,
  invalidClientAssertionFormat,
  invalidPurposeIdClaimFormat,
  invalidSubject,
  issuedAtNotFound,
  issuerNotFound,
  jtiNotFound,
  subjectNotFound,
  unexpectedClientAssertionPayload,
} from "../src/errors.js";
import { ConsumerKey } from "../src/types.js";
import { getMockClientAssertion, getMockConsumerKey } from "./utils.js";

describe("test", () => {
  describe("validateRequestParameters", () => {
    it("invalidAssertionType", () => {
      // todo
      expect(1).toBe(1);
    });
    it("invalidGrantType", () => {
      // todo
      expect(1).toBe(1);
    });
  });

  describe("verifyClientAssertion", () => {
    it("invalidAudienceFormat", () => {
      const a = getMockClientAssertion({
        customHeader: {},
        payload: { aud: "random" },
        customClaims: { key: 1 },
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudienceFormat());
    });

    it("invalidAudience", () => {
      const a = getMockClientAssertion({
        customHeader: {},
        payload: { aud: ["random"] },
        customClaims: { key: 1 },
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAudience());
    });

    it("invalidClientAssertionFormat", () => {
      const { errors } = verifyClientAssertion("not a jwt", undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidClientAssertionFormat());
    });

    it("invalidClientAssertionFormat", () => {
      const { errors } = verifyClientAssertion("not.a.jwt", undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidClientAssertionFormat());
    });

    it("invalidClientAssertionFormat", () => {
      const { errors } = verifyClientAssertion(
        `${generateId()}.${generateId()}`,
        undefined
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidClientAssertionFormat());
    });

    it.skip("unexpectedClientAssertionPayload", () => {
      // to do: how to test? In this case the payload should be a string

      const key = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      }).privateKey;

      const options: jwt.SignOptions = {
        header: {
          kid: generateId(),
          alg: "RS256",
        },
      };
      const jws = jwt.sign("actualPayload", key, options);

      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(unexpectedClientAssertionPayload());
    });

    it("jtiNotFound", () => {
      const a = getMockClientAssertion({
        customHeader: {},
        payload: { jti: undefined },
        customClaims: { key: 1 },
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(jtiNotFound());
    });

    it.skip("iatNotFound", () => {
      // to do: how to test? The sign function automatically adds iat if not present

      const a = getMockClientAssertion({
        customHeader: {},
        payload: {},
        customClaims: { key: 1 },
      });
      const { errors } = verifyClientAssertion(a, undefined);
      // console.log(errors);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(issuedAtNotFound());
      // console.log("error code: ", errors[0].code);
    });

    it("expNotFound", () => {
      const keySet = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });

      const payload = {
        iss: generateId<ClientId>(),
        sub: generateId<ClientId>(),
        aud: ["test.interop.pagopa.it"],
        jti: generateId(),
        iat: 5,
      };

      const options: jwt.SignOptions = {
        header: {
          kid: generateId(),
          alg: "RS256",
        },
      };
      const jws = jwt.sign(payload, keySet.privateKey, options);
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(expNotFound());
    });

    it("issuerNotFound", () => {
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: { iss: undefined },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(issuerNotFound());
    });

    it("subjectNotFound", () => {
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: { sub: undefined },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(subjectNotFound());
    });

    it("invalidSubject", () => {
      const subject = generateId<ClientId>();
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: { sub: subject },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, generateId<ClientId>());
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidSubject(subject));
    });

    it("invalidSubjectFormat", () => {
      const subject = "not a client id";
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: { sub: subject },
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, generateId<ClientId>());
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidSubjectFormat(subject));
    });

    it("invalidPurposeIdClaimFormat", () => {
      const notPurposeId = "not a purpose id";
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: {},
        customClaims: { purposeId: notPurposeId },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidPurposeIdClaimFormat(notPurposeId));
    });

    it("invalidClientIdFormat", () => {
      const notClientId = "not a client id";
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: {},
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, notClientId);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidClientIdFormat(notClientId));
    });

    it("digestClaimNotFound", () => {
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: {},
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(digestClaimNotFound());
    });

    it("invalidDigestClaims", () => {
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: {},
        customClaims: { digest: { alg: "alg", invalidProp: true } },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidDigestClaims());
    });

    it("invalidHashLength", () => {
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: {},
        customClaims: {
          digest: { alg: "alg", value: "todo string of wrong length" },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidHashLength());
    });

    it("InvalidHashAlgorithm", () => {
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: {},
        customClaims: {
          digest: { alg: "wrong alg", value: "todo string of correct length" },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidHashAlgorithm());
    });

    it("AlgorithmNotFound", () => {
      const jws = getMockClientAssertion({
        customHeader: { alg: undefined },
        payload: {},
        customClaims: {
          digest: { alg: "alg", value: "todo string of correct length" },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(algorithmNotFound());
    });

    it("AlgorithmNotAllowed", () => {
      const jws = getMockClientAssertion({
        customHeader: { alg: "todo not allowed alg" },
        payload: {},
        customClaims: {
          digest: { alg: "alg", value: "todo string of correct length" },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(algorithmNotAllowed());
    });

    it("purposeIdNotProvided", () => {
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: { purposeId: undefined },
        customClaims: {
          digest: { alg: "alg", value: "todo string of correct length" },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(algorithmNotAllowed());
    });

    it("PurposeNotFound", () => {
      // todo
      expect(1).toBe(1);
    });

    it("InvalidKidFormat", () => {
      const jws = getMockClientAssertion({
        customHeader: { kid: "not-a-valid-kid" },
        payload: {},
        customClaims: {
          digest: { alg: "alg", value: "todo string of correct length" },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidKidFormat());
    });
  });

  describe("verifyClientAssertionSignature", () => {
    it("invalidClientAssertionSignatureType", () => {
      // todo: find out when the jwonwebtoken.verify functin returns a string
      expect(1).toBe(1);
    });
    it("tokenExpiredError", () => {
      const date1 = new Date();
      const sixHoursAgo = new Date(date1.setHours(date1.getHours() - 6));
      const date2 = new Date();
      const threeHourAgo = new Date(date2.setHours(date2.getHours() - 3));

      const jws = getMockClientAssertion({
        customHeader: { kid: "not-a-valid-kid" },
        payload: {
          iat: sixHoursAgo.getSeconds(),
          exp: threeHourAgo.getSeconds(),
        },
        customClaims: {
          digest: { alg: "alg", value: "todo string of correct length" },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(tokenExpiredError());
    });
    it("jsonWebTokenError", () => {
      // todo
      expect(1).toBe(1);
    });
    it("notBeforeError", () => {
      const date1 = new Date();
      const threeHoursAgo = new Date(date1.setHours(date1.getHours() - 3));

      const date2 = new Date();
      const threeHoursLater = new Date(date2.setHours(date2.getHours() + 3));

      const date3 = new Date();
      const sixHoursLater = new Date(date3.setHours(date3.getHours() + 6));

      const jws = getMockClientAssertion({
        customHeader: { kid: "not-a-valid-kid" },
        payload: {
          iat: threeHoursAgo.getSeconds(),
          exp: sixHoursLater.getSeconds(),
          nbf: threeHoursLater.getSeconds(),
        },
        customClaims: {
          digest: { alg: "alg", value: "todo string of correct length" },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(notBeforeError());
    });
    it("clientAssertionSignatureVerificationFailure", () => {
      // todo
      expect(1).toBe(1);
    });
  });

  describe("assertValidPlatformStates", () => {
    it("inactiveAgreement", () => {
      const mockKey: ConsumerKey = {
        ...getMockConsumerKey(),
        agreementState: itemState.inactive,
      };
      assertValidPlatformState(mockKey);
      const errors = assertValidPlatformState(mockKey);

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(inactiveAgreement());
    });
    it("inactiveAgreement", () => {
      const mockKey: ConsumerKey = {
        ...getMockConsumerKey(),
        descriptorState: itemState.inactive,
      };
      assertValidPlatformState(mockKey);
      const errors = assertValidPlatformState(mockKey);

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(inactiveEService());
    });
    it("inactivePurpose", () => {
      const mockKey: ConsumerKey = {
        ...getMockConsumerKey(),
        purposeState: itemState.inactive,
      };
      assertValidPlatformState(mockKey);
      const errors = assertValidPlatformState(mockKey);

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(inactivePurpose());
    });
  });
});
