/* eslint-disable @typescript-eslint/no-non-null-assertion */
import crypto from "crypto";
import { fail } from "assert";
import { describe, expect, it } from "vitest";
import {
  ClientId,
  clientKindTokenStates,
  generateId,
  itemState,
  PurposeId,
} from "pagopa-interop-models";
import * as jwt from "jsonwebtoken";
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
  invalidAssertionType,
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
  jsonWebTokenError,
  jtiNotFound,
  notBeforeError,
  subjectNotFound,
  tokenExpiredError,
  unexpectedClientAssertionPayload,
  invalidDigestFormat,
  purposeIdNotProvided,
  unexpectedKeyType,
} from "../src/errors.js";
import { ConsumerKey } from "../src/types.js";
import {
  getMockAccessTokenRequest,
  getMockApiKey,
  getMockClientAssertion,
  getMockConsumerKey,
  value64chars,
} from "./utils.js";

describe("validation test", () => {
  describe("validateRequestParameters", () => {
    it("success request parameters", () => {
      const request = getMockAccessTokenRequest();
      const { errors } = validateRequestParameters(request);
      expect(errors).toBeUndefined();
    });

    it("invalidAssertionType", () => {
      const wrongAssertionType = "something-wrong";
      const request = {
        ...getMockAccessTokenRequest(),
        client_assertion_type: wrongAssertionType,
      };
      const { errors } = validateRequestParameters(request);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidAssertionType(wrongAssertionType));
    });
    // it("invalidGrantType", () => {
    //   const wrongGrantType = "something-wrong";
    //   const request = {
    //     ...getMockAccessTokenRequest(),
    //     grant_type: wrongGrantType,
    //   };
    //   // TODO: mock already checks grant type
    //   const errors = validateRequestParameters(request);
    //   expect(errors).toBeDefined();
    //   expect(errors).toHaveLength(1);
    //   expect(errors![0]).toEqual(invalidGrantType(wrongGrantType));
    // });
  });

  describe("verifyClientAssertion", () => {
    it("success client assertion", () => {
      const a = getMockClientAssertion({
        customHeader: {},
        payload: {},
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeUndefined();
    });

    it("invalidAudienceFormat", () => {
      const a = getMockClientAssertion({
        customHeader: {},
        payload: { aud: "random" },
        customClaims: {},
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
        customClaims: {},
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

    it("unexpectedClientAssertionPayload", () => {
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
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(jtiNotFound());
    });

    it.skip("iatNotFound", () => {
      // TODO: how to test? The sign function automatically adds iat if not present

      const a = getMockClientAssertion({
        customHeader: {},
        payload: {},
        customClaims: { key: 1 },
      });
      const { errors } = verifyClientAssertion(a, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(issuedAtNotFound());
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
          kid: "TODO",
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
      const clientId: ClientId = generateId();
      const subject = "not a client id";
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: { sub: subject },
        customClaims: {},
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
        customClaims: {
          digest: undefined,
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(digestClaimNotFound());
    });

    it("invalidDigestFormat", () => {
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
          digest: { alg: "SHA256", value: "TODO string of wrong length" },
        },
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
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
      // TODO it seems this can't be tested because we need alg header to sign the mock jwt
      const jws = getMockClientAssertion({
        customHeader: { alg: undefined },
        payload: {},
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(algorithmNotFound());
    });

    it("AlgorithmNotAllowed", () => {
      const notAllowedAlg = "RS512";
      const jws = getMockClientAssertion({
        customHeader: { alg: "RS512" },
        payload: {},
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(algorithmNotAllowed(notAllowedAlg));
    });

    it("InvalidKidFormat", () => {
      const jws = getMockClientAssertion({
        customHeader: { kid: "not-a-valid-kid" },
        payload: {},
        customClaims: {},
      });
      const { errors } = verifyClientAssertion(jws, undefined);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(invalidKidFormat());
    });
  });

  describe("verifyClientAssertionSignature", () => {
    it("success client assertion signature", () => {
      const threeHourLater = new Date();
      threeHourLater.setHours(threeHourLater.getHours() + 3);

      const keySet = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });

      const jws = getMockClientAssertion({
        customHeader: {},
        payload: {
          iat: new Date().getTime() / 1000,
          exp: threeHourLater.getTime() / 1000,
        },
        customClaims: {},
        keySet,
      });
      const publicKey = keySet.publicKey
        .export({
          type: "pkcs1",
          format: "pem",
        })
        .toString();
      const mockConsumerKey = {
        ...getMockConsumerKey(),
        publicKey,
      };
      const { errors } = verifyClientAssertionSignature(jws, mockConsumerKey);
      expect(errors).toBeUndefined();
    });

    it.skip("invalidClientAssertionSignatureType", () => {
      // TODO: find out when the jwonwebtoken.verify function returns a string
      expect(1).toBe(1);
    });
    it("tokenExpiredError", () => {
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

      const threeHourAgo = new Date();
      threeHourAgo.setHours(threeHourAgo.getHours() - 3);

      const keySet = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });

      const jws = getMockClientAssertion({
        customHeader: {},
        payload: {
          iat: sixHoursAgo.getTime() / 1000,
          exp: threeHourAgo.getTime() / 1000,
        },
        customClaims: {},
        keySet,
      });
      const publicKey = keySet.publicKey
        .export({
          type: "pkcs1",
          format: "pem",
        })
        .toString();
      const mockConsumerKey = {
        ...getMockConsumerKey(),
        publicKey,
      };
      const { errors } = verifyClientAssertionSignature(jws, mockConsumerKey);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(tokenExpiredError());
    });
    it("jsonWebTokenError", () => {
      const mockKey = getMockConsumerKey();
      const { errors } = verifyClientAssertionSignature(
        "not-a-valid-jws",
        mockKey
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0].title).toEqual(jsonWebTokenError("").title);
    });
    it("notBeforeError", () => {
      const threeHoursAgo = new Date();
      threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);

      const threeHoursLater = new Date();
      threeHoursLater.setHours(threeHoursLater.getHours() + 3);

      const sixHoursLater = new Date();
      sixHoursLater.setHours(sixHoursLater.getHours() + 6);

      const keySet = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });
      const jws = getMockClientAssertion({
        customHeader: {},
        payload: {
          iat: threeHoursAgo.getTime() / 1000,
          exp: sixHoursLater.getTime() / 1000,
          nbf: threeHoursLater.getTime() / 1000,
        },
        customClaims: {},
        keySet,
      });
      const publicKey = keySet.publicKey.export({
        type: "pkcs1",
        format: "pem",
      }) as string;
      const mockConsumerKey = {
        ...getMockConsumerKey(),
        publicKey,
      };

      const { errors } = verifyClientAssertionSignature(jws, mockConsumerKey);
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors![0]).toEqual(notBeforeError());
    });
    it.skip("clientAssertionSignatureVerificationFailure", () => {
      // TODO: not sure when this happens
      expect(1).toBe(1);
    });
  });

  describe("validatePlatformState", () => {
    it("success", () => {
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

    it("inactiveAgreement", () => {
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
    it("inactiveAgreement", () => {
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
    it("inactivePurpose", () => {
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
  });

  describe("validateClientKindAndPlatformState", () => {
    it("unexpectedKeyType (consumerKey and clientKind.api)", () => {
      const mockConsumerKey = {
        ...getMockConsumerKey(),
        clientKind: clientKindTokenStates.api,
      };
      const { data: mockClientAssertion } = verifyClientAssertion(
        getMockClientAssertion({
          customHeader: {},
          payload: {},
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
      expect(errors![0]).toEqual(unexpectedKeyType(mockConsumerKey.clientKind));
    });

    // it("unexpectedKeyType (apiKey and clientKindTokenStates.consumer)", () => {
    //   const mockApiKey = {
    //     ...getMockApiKey(),
    //     clientKind: clientKindTokenStates.consumer,
    //   };
    //   const { data: mockClientAssertion } = verifyClientAssertion(
    //     getMockClientAssertion({
    //       customHeader: {},
    //       payload: {},
    //       customClaims: {},
    //     }),
    //     undefined
    //   );
    //   if (!mockClientAssertion) {
    //     fail();
    //   }
    //   const { errors } = validateClientKindAndPlatformState(
    //     // FIX
    //     mockApiKey,
    //     mockClientAssertion
    //   );
    //   expect(errors).toBeDefined();
    //   expect(errors).toHaveLength(1);
    //   expect(errors![0]).toEqual(unexpectedKeyType(mockApiKey.clientKind));
    // });

    it("success (consumerKey and clientKindTokenStates.consumer; valid platform states)", () => {
      const mockConsumerKey = getMockConsumerKey();
      const { data: mockClientAssertion } = verifyClientAssertion(
        getMockClientAssertion({
          customHeader: {},
          payload: { purposeId: generateId<PurposeId>() },
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

    it("inactiveEService (consumerKey and clientKindTokenStates.consumer; invalid platform states)", () => {
      const mockConsumerKey: ConsumerKey = {
        ...getMockConsumerKey(),
        descriptorState: itemState.inactive,
      };
      const { data: mockClientAssertion } = verifyClientAssertion(
        getMockClientAssertion({
          customHeader: {},
          payload: { purposeId: generateId<PurposeId>() },
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

    it("success (apiKey and clientKindTokenStates.api)", () => {
      const mockApiKey = getMockApiKey();
      const { data: mockClientAssertion } = verifyClientAssertion(
        getMockClientAssertion({
          customHeader: {},
          payload: {},
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

    it("purposeIdNotProvided", () => {
      const mockConsumerKey = getMockConsumerKey();
      const { data: mockClientAssertion } = verifyClientAssertion(
        getMockClientAssertion({
          customHeader: {},
          payload: { purposeId: undefined },
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
  });
});

// const printErrors = (errors?: Array<ApiError<ErrorCodes>>): void => {
//   if (errors) {
//     errors.forEach((e) => console.log(e.code, e.detail));
//   }
// };
