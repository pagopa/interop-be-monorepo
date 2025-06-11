import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  generateKeySet,
  getMockDPoPProof,
  signJWT,
} from "pagopa-interop-commons-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { algorithm } from "pagopa-interop-models";
import { dateToSeconds } from "pagopa-interop-commons";
import {
  checkDPoPCache,
  verifyDPoPProof,
  verifyDPoPProofSignature,
} from "../src/validation.js";
import {
  dpopAlgorithmsMismatch,
  dpopHtmNotFound,
  dpopHtuNotFound,
  dpopIatNotFound,
  dpopJtiNotFound,
  dpopProofInvalidClaims,
  expiredDPoPProof,
  invalidDPoPHtm,
  invalidDPoPHtu,
  invalidDPoPProofFormat,
  invalidDPoPTyp,
  invalidDPoPJwt,
  invalidDPoPSignature,
  dpopJtiAlreadyCached,
  dpopTypNotFound,
  multipleDPoPProofsError,
} from "../src/errors.js";
import { writeDPoPCache } from "../src/utilities/dpopCacheUtils.js";
import { dynamoDBClient, dpopCacheTable } from "./utils.js";

describe("DPoP validation tests", async () => {
  describe("verify DPoP proof", () => {
    it("should succeed DPoP claims verification", async () => {
      const { dpopProofJWS, dpopProofJWT } = await getMockDPoPProof();

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopProofJWT.payload.htu,
      });

      expect(errors).toBeUndefined();
    });

    it("should add error if there are invalid claims in the DPoP proof header", async () => {
      const { dpopProofJWS, dpopProofJWT } = await getMockDPoPProof({
        customHeader: {
          invalidHeaderProp: "invalidHeaderProp",
        },
      });
      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopProofJWT.payload.htu,
      });

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(dpopProofInvalidClaims("").code);
    });

    it("should add error if there are invalid claims in the DPoP proof payload", async () => {
      const { dpopProofJWS, dpopProofJWT } = await getMockDPoPProof({
        customPayload: {
          invalidPayloadProp: "invalidPayloadProp",
        },
      });
      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopProofJWT.payload.htu,
      });

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(dpopProofInvalidClaims("").code);
    });

    it("should not add error if the DPoP proof signature is wrong", async () => {
      const { dpopProofJWS: dpopProofJWS1, dpopProofJWT } =
        await getMockDPoPProof();
      const { dpopProofJWS: dpopProofJWS2 } = await getMockDPoPProof();

      const subStrings1 = dpopProofJWS1.split(".");
      const subStrings2 = dpopProofJWS2.split(".");

      const dpopProofWithWrongSignature = `${subStrings1[0]}.${subStrings1[1]}.${subStrings2[2]}`;
      const { errors } = verifyDPoPProof({
        dpopProofJWS: dpopProofWithWrongSignature,
        expectedDPoPProofHtu: dpopProofJWT.payload.htu,
      });
      expect(errors).toBeUndefined();
    });

    it("should add error if the DPoP proof JWT format is invalid", async () => {
      const { errors: errors1 } = verifyDPoPProof({
        dpopProofJWS: "too.many.substrings.in.dpop.proof",
        expectedDPoPProofHtu: "test",
      });
      expect(errors1).toBeDefined();
      expect(errors1).toHaveLength(1);
      expect(errors1?.[0]).toEqual(invalidDPoPProofFormat("Invalid JWT"));

      const { errors: errors2 } = verifyDPoPProof({
        dpopProofJWS: "not a jwt",
        expectedDPoPProofHtu: "test",
      });
      expect(errors2).toBeDefined();
      expect(errors2).toHaveLength(1);
      expect(errors2?.[0]).toEqual(invalidDPoPProofFormat("Invalid JWT"));

      const { errors: errors3 } = verifyDPoPProof({
        dpopProofJWS: "not.a.jwt",
        expectedDPoPProofHtu: "test",
      });
      expect(errors3).toBeDefined();
      expect(errors3).toHaveLength(1);
      expect(errors3?.[0]).toEqual(
        invalidDPoPProofFormat("Failed to parse the decoded payload as JSON")
      );

      const { errors: errors4 } = verifyDPoPProof({
        dpopProofJWS: "signature.missing",
        expectedDPoPProofHtu: "test",
      });
      expect(errors4).toBeDefined();
      expect(errors4).toHaveLength(1);
      expect(errors4?.[0]).toEqual(invalidDPoPProofFormat("Invalid JWT"));
    });

    it("should add error if the DPoP proof TYP is not found", async () => {
      const { dpopProofJWS, dpopProofJWT } = await getMockDPoPProof({
        customHeader: {
          typ: undefined,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopProofJWT.payload.htu,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(dpopTypNotFound().code);
    });

    it("should add error if the DPoP proof TYP is invalid", async () => {
      const wrongTyp = "wrong-typ";
      const { dpopProofJWS, dpopProofJWT } = await getMockDPoPProof({
        customHeader: {
          typ: wrongTyp,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopProofJWT.payload.htu,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(invalidDPoPTyp(wrongTyp).code);
    });

    it("should add error if the DPoP proof ALG is different from JWK's ALG", async () => {
      const { dpopProofJWT } = await getMockDPoPProof();

      const { keySet: keySetRS256 } = generateKeySet(algorithm.RS256);
      const dpopProofJWTWithWrongAlg = {
        ...dpopProofJWT,
        header: {
          ...dpopProofJWT.header,
          alg: algorithm.RS256,
        },
      };
      const dpopProofJWSWithWrongAlg = await signJWT({
        payload: dpopProofJWTWithWrongAlg.payload,
        headers: dpopProofJWTWithWrongAlg.header,
        keySet: keySetRS256,
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS: dpopProofJWSWithWrongAlg,
        expectedDPoPProofHtu: dpopProofJWT.payload.htu,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(
        dpopAlgorithmsMismatch(
          dpopProofJWT.header.alg,
          dpopProofJWT.header.jwk.alg
        ).code
      );
    });

    it("should add error if the DPoP proof HTM is not found", async () => {
      const { dpopProofJWS, dpopProofJWT } = await getMockDPoPProof({
        customPayload: {
          htm: undefined,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopProofJWT.payload.htu,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(dpopHtmNotFound().code);
    });

    it("should add error if the DPoP proof HTM is invalid", async () => {
      const wrongHtm = "GET";
      const { dpopProofJWS, dpopProofJWT } = await getMockDPoPProof({
        customPayload: {
          htm: wrongHtm,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopProofJWT.payload.htu,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(invalidDPoPHtm(wrongHtm).code);
    });

    it("should add error if the DPoP proof HTU is not found", async () => {
      const { dpopProofJWS } = await getMockDPoPProof({
        customPayload: {
          htu: undefined,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: "test",
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(dpopHtuNotFound().code);
    });

    it("should add error if the DPoP proof HTU is invalid", async () => {
      const wrongHtu = "wrong-htu";
      const { dpopProofJWS } = await getMockDPoPProof({
        customPayload: {
          htu: wrongHtu,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: "test",
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(invalidDPoPHtu(wrongHtu).code);
    });

    it("should add error if the DPoP proof IAT is not found", async () => {
      const { dpopProofJWS, dpopProofJWT } = await getMockDPoPProof({
        customPayload: {
          iat: undefined,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopProofJWT.payload.htu,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(dpopIatNotFound().code);
    });

    it("should add error if the DPoP proof IAT is invalid", async () => {
      const expiredIat = dateToSeconds(new Date()) - 61;
      const { dpopProofJWS, dpopProofJWT } = await getMockDPoPProof({
        customPayload: {
          iat: expiredIat,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopProofJWT.payload.htu,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(
        expiredDPoPProof(expiredIat, dateToSeconds(new Date())).code
      );
    });

    it("should add error if the DPoP proof JTI is not found", async () => {
      const { dpopProofJWS, dpopProofJWT } = await getMockDPoPProof({
        customPayload: {
          jti: undefined,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopProofJWT.payload.htu,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(dpopJtiNotFound().code);
    });

    it("should add error if the headers contain multiple DPoP proofs", async () => {
      const { dpopProofJWT } = await getMockDPoPProof();

      const { errors } = verifyDPoPProof({
        dpopProofJWS: "dpopProof1, dpopProof2",
        expectedDPoPProofHtu: dpopProofJWT.payload.htu,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toEqual(multipleDPoPProofsError().code);
    });
  });

  describe("verify DPoP proof signature", () => {
    it("should succeed DPoP proof signature verification", async () => {
      const { dpopProofJWS, dpopProofJWT } = await getMockDPoPProof();
      const { errors } = await verifyDPoPProofSignature(
        dpopProofJWS,
        dpopProofJWT.header.jwk
      );
      expect(errors).toBeUndefined();
    });

    it("should add error if JWT format is invalid", async () => {
      const { dpopProofJWT } = await getMockDPoPProof();

      const { errors } = await verifyDPoPProofSignature(
        "not-a-valid-jws",
        dpopProofJWT.header.jwk
      );
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toEqual(invalidDPoPJwt("").code);
    });

    it("should add error if the DPoP proof signature is wrong", async () => {
      const { dpopProofJWS: dpopProofJWS1, dpopProofJWT } =
        await getMockDPoPProof();
      const { dpopProofJWS: dpopProofJWS2 } = await getMockDPoPProof();

      const subStrings1 = dpopProofJWS1.split(".");
      const subStrings2 = dpopProofJWS2.split(".");

      const dpopProofWithWrongSignature = `${subStrings1[0]}.${subStrings1[1]}.${subStrings2[2]}`;
      const { errors } = await verifyDPoPProofSignature(
        dpopProofWithWrongSignature,
        dpopProofJWT.header.jwk
      );
      expect(errors?.[0].code).toEqual(invalidDPoPSignature().code);
    });
  });

  describe("check DPoP Proof cache table", () => {
    beforeEach(async () => {
      await buildDynamoDBTables(dynamoDBClient);
    });
    afterEach(async () => {
      await deleteDynamoDBTables(dynamoDBClient);
    });

    it("should succeed if the DPoP proof is not in the cache", async () => {
      const { dpopProofJWT } = await getMockDPoPProof();
      const { errors } = await checkDPoPCache({
        dynamoDBClient,
        dpopCacheTable,
        dpopProofJti: dpopProofJWT.payload.jti,
        dpopProofIat: dpopProofJWT.payload.iat,
      });

      expect(errors).toBeUndefined();
    });

    it("should add error if the DPoP proof is already in the cache", async () => {
      const { dpopProofJWT } = await getMockDPoPProof();

      await writeDPoPCache({
        dynamoDBClient,
        dpopCacheTable,
        iat: dpopProofJWT.payload.iat,
        jti: dpopProofJWT.payload.jti,
      });

      const { errors } = await checkDPoPCache({
        dynamoDBClient,
        dpopCacheTable,
        dpopProofJti: dpopProofJWT.payload.jti,
        dpopProofIat: dpopProofJWT.payload.iat,
      });

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toEqual(
        dpopJtiAlreadyCached(dpopProofJWT.payload.jti).code
      );
    });
  });
});
