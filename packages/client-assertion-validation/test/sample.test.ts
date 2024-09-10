import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { ClientId, generateId } from "pagopa-interop-models";
import * as jwt from "jsonwebtoken";
import { verifyClientAssertion } from "../src/utils.js";
import {
  expNotFound,
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
import { getMockClientAssertion } from "./utils.js";

describe("test", () => {
  describe("verifyClientAssertion", () => {
    it("invalidAudienceFormat", () => {
      const keySet = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });

      const payload = {
        iss: generateId<ClientId>(),
        sub: generateId<ClientId>(),
        aud: "not an array",
        exp: 60,
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
      const errors = verifyClientAssertion(jws, undefined);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(invalidAudienceFormat());
    });

    it("invalidAudience", () => {
      const a = getMockClientAssertion({
        payload: { aud: ["random"] },
        customClaims: { key: 1 },
      });
      const errors = verifyClientAssertion(a, undefined);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(invalidAudience());
    });

    it("invalidClientAssertionFormat", () => {
      const errors = verifyClientAssertion("not a jwt", undefined);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(invalidClientAssertionFormat());
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

      const errors = verifyClientAssertion(jws, undefined);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(unexpectedClientAssertionPayload());
    });

    it("jtiNotFound", () => {
      const a = getMockClientAssertion({
        payload: { jti: undefined },
        customClaims: { key: 1 },
      });
      const errors = verifyClientAssertion(a, undefined);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(jtiNotFound());
    });

    it.skip("iatNotFound", () => {
      // to do: how to test? The sign function automatically adds iat if not present

      const a = getMockClientAssertion({
        payload: {},
        customClaims: { key: 1 },
      });
      const errors = verifyClientAssertion(a, undefined);
      // console.log(errors);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(issuedAtNotFound());
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
      const errors = verifyClientAssertion(jws, undefined);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(expNotFound());
    });

    it("issuerNotFound", () => {
      const jws = getMockClientAssertion({
        payload: { iss: undefined },
        customClaims: {},
      });
      const errors = verifyClientAssertion(jws, undefined);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(issuerNotFound());
    });

    it("subjectNotFound", () => {
      const jws = getMockClientAssertion({
        payload: { sub: undefined },
        customClaims: {},
      });
      const errors = verifyClientAssertion(jws, undefined);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(subjectNotFound());
    });

    it("invalidSubject", () => {
      const subject = generateId<ClientId>();
      const jws = getMockClientAssertion({
        payload: { sub: subject },
        customClaims: {},
      });
      const errors = verifyClientAssertion(jws, generateId<ClientId>());
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(invalidSubject(subject));
    });

    it("invalidPurposeIdClaimFormat", () => {
      const notPurposeId = "not a purpose id";
      const jws = getMockClientAssertion({
        payload: {},
        customClaims: { purposeId: notPurposeId },
      });
      const errors = verifyClientAssertion(jws, undefined);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(invalidPurposeIdClaimFormat(notPurposeId));
    });
  });
});
