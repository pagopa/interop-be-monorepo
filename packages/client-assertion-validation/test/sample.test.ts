/* eslint-disable @typescript-eslint/no-non-null-assertion */
import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  ApiError,
  ClientId,
  generateId,
  itemState,
} from "pagopa-interop-models";
import * as jwt from "jsonwebtoken";
import {
  assertValidPlatformState,
  verifyClientAssertion,
} from "../src/utils.js";
import {
  algorithmNotAllowed,
  algorithmNotFound,
  digestClaimNotFound,
  ErrorCodes,
  expNotFound,
  inactiveAgreement,
  inactiveEService,
  inactivePurpose,
  invalidAudience,
  invalidAudienceFormat,
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
  jtiNotFound,
  notBeforeError,
  subjectNotFound,
  tokenExpiredError,
  unexpectedClientAssertionPayload,
} from "../src/errors.js";
import { ConsumerKey } from "../src/types.js";
import { invalidDigestFormat, purposeIdNotProvided } from "../dist/errors.js";
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

  const value64chars =
    "1234567890123456789012345678901234567890123456789012345678901234";
  describe("verifyClientAssertion", () => {
    it("invalidAudienceFormat", () => {
      const a = getMockClientAssertion({
        customHeader: {},
        payload: { aud: "random" },
        customClaims: {
          digest: {
            alg: "SHA256",
            value: value64chars,
          },
        },
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
        customClaims: {
          digest: {
            alg: "SHA256",
            value: value64chars,
          },
        },
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      printErrors(errors);

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
        customClaims: {
          digest: {
            alg: "SHA256",
            value: value64chars,
          },
        },
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      printErrors(errors);
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
        digest: {
          alg: "SHA256",
          value: value64chars,
        },
      };

      const options: jwt.SignOptions = {
        header: {
          kid: "todo",
          alg: "RS256",
        },
      };
      const jws = jwt.sign(payload, keySet.privateKey, options);
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      printErrors(errors);
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(expNotFound());
    });

    it("issuerNotFound", () => {
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: { iss: undefined },
        customClaims: {
          digest: {
            alg: "SHA256",
            value: value64chars,
          },
        },
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
        customClaims: {
          digest: {
            alg: "SHA256",
            value: value64chars,
          },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      printErrors(errors);
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(subjectNotFound());
    });

    it("invalidSubject", () => {
      const subject = generateId<ClientId>();
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: { sub: subject },
        customClaims: {
          digest: {
            alg: "SHA256",
            value: value64chars,
          },
        },
      });
      const { errors } = verifyClientAssertion(jws, generateId<ClientId>());
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidSubject(subject));
    });

    it("invalidSubjectFormat", () => {
      const clientId: ClientId = generateId();
      const subject = "not a client id";
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: { sub: subject },
        customClaims: {
          digest: {
            alg: "SHA256",
            value: value64chars,
          },
        },
      });
      const { errors } = verifyClientAssertion(jws, clientId);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidSubjectFormat(subject));
    });

    it("invalidPurposeIdClaimFormat", () => {
      const notPurposeId = "not a purpose id";
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: {},
        customClaims: {
          purposeId: notPurposeId,
          digest: {
            alg: "SHA256",
            value: value64chars,
          },
        },
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
        customClaims: {
          digest: {
            alg: "SHA256",
            value: value64chars,
          },
        },
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
      expect(errors![0]).toEqual(invalidDigestFormat());
    });

    it("invalidHashLength", () => {
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: {},
        customClaims: {
          digest: { alg: "SHA256", value: "todo string of wrong length" },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      printErrors(errors);
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidHashLength("SHA256"));
    });

    it("InvalidHashAlgorithm", () => {
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: {},
        customClaims: {
          digest: { alg: "wrong alg", value: value64chars },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidHashAlgorithm());
    });

    it.skip("AlgorithmNotFound", () => {
      // todo it seems this can't be tested because we need alg header to sign the mock jwt
      const jws = getMockClientAssertion({
        customHeader: { alg: "undefined" },
        payload: {},
        customClaims: {
          digest: { alg: "RS256", value: value64chars },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      printErrors(errors);
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(algorithmNotFound());
    });

    it("AlgorithmNotAllowed", () => {
      const notAllowedAlg = "RS512";
      const jws = getMockClientAssertion({
        customHeader: { alg: "RS512" },
        payload: {},
        customClaims: {
          digest: { alg: "SHA256", value: value64chars },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(algorithmNotAllowed(notAllowedAlg));
    });

    it.skip("purposeIdNotProvided", () => {
      // todo this should be related to the case of consumerKey
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: { purposeId: undefined },
        customClaims: {
          digest: { alg: "SHA256", value: value64chars },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      printErrors(errors);
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(purposeIdNotProvided());
    });

    it.skip("PurposeNotFound", () => {
      // todo
      expect(1).toBe(1);
    });

    it("InvalidKidFormat", () => {
      const jws = getMockClientAssertion({
        customHeader: { kid: "not-a-valid-kid" },
        payload: {},
        customClaims: {
          digest: { alg: "SHA256", value: value64chars },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      printErrors(errors);
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
      // todo why does it fail?
      const date1 = new Date();
      const sixHoursAgo = new Date(date1.setHours(date1.getHours() - 6));
      const date2 = new Date();
      const threeHourAgo = new Date(date2.setHours(date2.getHours() - 3));

      const jws = getMockClientAssertion({
        customHeader: {},
        payload: {
          iat: sixHoursAgo.getSeconds(),
          exp: threeHourAgo.getSeconds(),
        },
        customClaims: {
          digest: { alg: "SHA256", value: value64chars },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      printErrors(errors);
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(tokenExpiredError());
    });
    it("jsonWebTokenError", () => {
      // todo
      expect(1).toBe(1);
    });
    it("notBeforeError", () => {
      // todo why does it fail?

      const date1 = new Date();
      const threeHoursAgo = new Date(date1.setHours(date1.getHours() - 3));

      const date2 = new Date();
      const threeHoursLater = new Date(date2.setHours(date2.getHours() + 3));

      const date3 = new Date();
      const sixHoursLater = new Date(date3.setHours(date3.getHours() + 6));

      const jws = getMockClientAssertion({
        customHeader: {},
        payload: {
          iat: threeHoursAgo.getSeconds(),
          exp: sixHoursLater.getSeconds(),
          nbf: threeHoursLater.getSeconds(),
        },
        customClaims: {
          digest: { alg: "SHA256", value: value64chars },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      printErrors(errors);
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

const printErrors = (errors?: Array<ApiError<ErrorCodes>>): void => {
  if (errors) {
    errors.forEach((e) => console.log(e.code, e.detail));
  }
};
