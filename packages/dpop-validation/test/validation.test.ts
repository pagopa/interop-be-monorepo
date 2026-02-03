/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { DPoPProof } from "pagopa-interop-models";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dateToSeconds } from "pagopa-interop-commons";
import {
  checkDPoPCache,
  verifyDPoPProof,
  verifyDPoPProofSignature,
  verifyDPoPThumbprintMatch,
} from "../src/validation.js";
import {
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
  notYetValidDPoPProof,
  dpopTokenBindingMismatch,
  dpopJwkNotFound,
} from "../src/errors.js";
import { writeDPoPCache } from "../src/utilities/dpopCacheUtils.js";

import { dpopConfig, dynamoDBClient, dpopCacheTable } from "./utils.js";

describe("DPoP validation tests", async () => {
  describe("verify DPoP proof", () => {
    it("should succeed DPoP claims verification", async () => {
      const { dpopProofJWS } = await getMockDPoPProof();

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });

      expect(errors).toBeUndefined();
    });

    it("should add error if there are invalid claims in the DPoP proof header", async () => {
      const { dpopProofJWS } = await getMockDPoPProof({
        customHeader: {
          invalidHeaderProp: "invalidHeaderProp",
        },
      });
      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(
        dpopProofInvalidClaims("{}", "header").code
      );
    });

    it("should add error if there are invalid claims in the DPoP proof payload", async () => {
      const { dpopProofJWS } = await getMockDPoPProof({
        customPayload: {
          invalidPayloadProp: "invalidPayloadProp",
        },
      });
      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(
        dpopProofInvalidClaims("{}", "payload").code
      );
    });

    it("should not add error if the DPoP proof signature is wrong", async () => {
      const { dpopProofJWS: dpopProofJWS1 } = await getMockDPoPProof();
      const { dpopProofJWS: dpopProofJWS2 } = await getMockDPoPProof();

      const subStrings1 = dpopProofJWS1.split(".");
      const subStrings2 = dpopProofJWS2.split(".");

      const dpopProofWithWrongSignature = `${subStrings1[0]}.${subStrings1[1]}.${subStrings2[2]}`;
      const { errors } = verifyDPoPProof({
        dpopProofJWS: dpopProofWithWrongSignature,
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });
      expect(errors).toBeUndefined();
    });

    it("should add error if the DPoP proof JWT format is invalid", async () => {
      const { errors: errors1 } = verifyDPoPProof({
        dpopProofJWS: "too.many.substrings.in.dpop.proof",
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });
      expect(errors1).toBeDefined();
      expect(errors1).toHaveLength(1);
      expect(errors1?.[0]).toEqual(invalidDPoPProofFormat("Invalid JWT"));

      const { errors: errors2 } = verifyDPoPProof({
        dpopProofJWS: "not a jwt",
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });
      expect(errors2).toBeDefined();
      expect(errors2).toHaveLength(1);
      expect(errors2?.[0]).toEqual(invalidDPoPProofFormat("Invalid JWT"));

      const { errors: errors3 } = verifyDPoPProof({
        dpopProofJWS: "not.a.jwt",
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });
      expect(errors3).toBeDefined();
      expect(errors3).toHaveLength(1);
      expect(errors3?.[0]).toEqual(
        invalidDPoPProofFormat("Failed to parse the decoded payload as JSON")
      );

      const { errors: errors4 } = verifyDPoPProof({
        dpopProofJWS: "signature.missing",
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });
      expect(errors4).toBeDefined();
      expect(errors4).toHaveLength(1);
      expect(errors4?.[0]).toEqual(invalidDPoPProofFormat("Invalid JWT"));
    });

    it("should add error if the DPoP proof TYP is not found", async () => {
      const { dpopProofJWS } = await getMockDPoPProof({
        customHeader: {
          typ: undefined,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(dpopTypNotFound().code);
    });

    it("should add error if the DPoP proof TYP is invalid", async () => {
      const wrongTyp = "wrong-typ";
      const { dpopProofJWS } = await getMockDPoPProof({
        customHeader: {
          typ: wrongTyp,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(invalidDPoPTyp(wrongTyp).code);
    });

    it("should add error if the DPoP proof HTM is not found", async () => {
      const { dpopProofJWS } = await getMockDPoPProof({
        customPayload: {
          htm: undefined,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(dpopHtmNotFound().code);
    });

    it("should add error if the DPoP proof HTM is invalid", async () => {
      const wrongHtm = "GET";
      const { dpopProofJWS } = await getMockDPoPProof({
        customPayload: {
          htm: wrongHtm,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
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
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
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
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(invalidDPoPHtu(wrongHtu).code);
    });

    it("should add error if the DPoP proof IAT is not found", async () => {
      const { dpopProofJWS } = await getMockDPoPProof({
        customPayload: {
          iat: undefined,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(dpopIatNotFound().code);
    });

    it("should add error if the DPoP proof IAT is greater than the current time + the tolerance (used to accommodate for clock differences between the client and the server)", async () => {
      const mockDate = new Date();
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const futureIat =
        dateToSeconds(mockDate) +
        Number(dpopConfig!.dpopIatToleranceSeconds) +
        1;
      const { dpopProofJWS } = await getMockDPoPProof({
        customPayload: {
          iat: futureIat,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(
        notYetValidDPoPProof(
          futureIat,
          dateToSeconds(new Date()),
          dpopConfig!.dpopIatToleranceSeconds
        ).code
      );

      vi.useRealTimers();
    });

    it("should succeed if the current time + the tolerance is greater or equal than the DPoP proof IAT", async () => {
      const futureIat =
        dateToSeconds(new Date()) + Number(dpopConfig!.dpopIatToleranceSeconds);
      const { dpopProofJWS } = await getMockDPoPProof({
        customPayload: {
          iat: futureIat,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });
      expect(errors).toBeUndefined();
    });

    it("should add error if the DPoP proof IAT is expired", async () => {
      const expiredIat = dateToSeconds(new Date()) - 61;
      const { dpopProofJWS } = await getMockDPoPProof({
        customPayload: {
          iat: expiredIat,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(
        expiredDPoPProof(
          expiredIat,
          dateToSeconds(new Date()),
          dpopConfig!.dpopDurationSeconds
        ).code
      );
    });

    it("should add error if the DPoP proof JTI is not found", async () => {
      const { dpopProofJWS } = await getMockDPoPProof({
        customPayload: {
          jti: undefined,
        },
      });

      const { errors } = verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });
      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(dpopJtiNotFound().code);
    });

    it("should add error if the headers contain multiple DPoP proofs", async () => {
      const { errors } = verifyDPoPProof({
        dpopProofJWS: "dpopProof1, dpopProof2",
        expectedDPoPProofHtu: dpopConfig!.dpopHtu,
        dpopProofIatToleranceSeconds: dpopConfig!.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
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
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
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
        durationSeconds: dpopConfig!.dpopDurationSeconds,
      });

      const { errors } = await checkDPoPCache({
        dynamoDBClient,
        dpopCacheTable,
        dpopProofJti: dpopProofJWT.payload.jti,
        dpopProofIat: dpopProofJWT.payload.iat,
        dpopProofDurationSeconds: dpopConfig!.dpopDurationSeconds,
      });

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toEqual(
        dpopJtiAlreadyCached(dpopProofJWT.payload.jti).code
      );
    });
  });
  describe("check DPoP binding with access token", () => {
    const validThumbprint = "NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs";

    it("should succeed if the DPoP proof JWK thumbprint matches the access token binding (jkt)", async () => {
      const { dpopProofJWT } = await getMockDPoPProof();

      const { errors } = verifyDPoPThumbprintMatch(
        dpopProofJWT,
        validThumbprint
      );

      expect(errors).toBeUndefined();
    });

    it("should add error if the DPoP proof JWK thumbprint does NOT match the access token binding", async () => {
      const { dpopProofJWT } = await getMockDPoPProof();
      const mismatchThumbprint = "invalid-thumbprint-hash";

      const { errors } = verifyDPoPThumbprintMatch(
        dpopProofJWT,
        mismatchThumbprint
      );

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(dpopTokenBindingMismatch().code);
    });

    it("should add error if the DPoP proof JWK is missing", async () => {
      const mockDPoPProof = {
        header: {
          jwk: undefined,
        },
      } as unknown as DPoPProof;

      const { errors } = verifyDPoPThumbprintMatch(
        mockDPoPProof,
        validThumbprint
      );

      expect(errors).toBeDefined();
      expect(errors).toHaveLength(1);
      expect(errors?.[0].code).toBe(dpopJwkNotFound().code);
    });
  });
});
