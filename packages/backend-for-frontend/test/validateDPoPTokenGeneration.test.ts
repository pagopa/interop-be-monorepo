import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, generateId } from "pagopa-interop-models";
import { AuthData } from "pagopa-interop-commons";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { bffApi } from "pagopa-interop-api-clients";
import * as dpopValidation from "pagopa-interop-dpop-validation";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { toolsServiceBuilder } from "../src/services/toolService.js";
import { getBffMockContext } from "./utils.js";

describe("validateDPoPTokenGeneration", () => {
  const MOCK_DPOP_PROOF = "test_dpop_proof_jws";
  const MOCK_HTU = "https://auth.interop.pagopa.it/token";
  const MOCK_HTM = "POST";

  const mockAuthData: AuthData = {
    ...getMockAuthData(),
    organizationId: generateId(),
  };

  const bffMockContext = getBffMockContext(
    getMockContext({ authData: mockAuthData })
  );

  const mockClients = {} as unknown as PagoPAInteropBeClients;
  const toolService = toolsServiceBuilder(mockClients);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Success case", () => {
    it("should validate DPoP token successfully", async () => {
      vi.spyOn(dpopValidation, "verifyDPoPProof").mockReturnValue({
        errors: undefined,
        data: {
          dpopProofJWT: {
            header: {
              alg: "RS256",
              typ: "dpop+jwt",
              jwk: { kty: "RSA", n: "...", e: "..." },
            },
            payload: { jti: "123", iat: 123, htu: MOCK_HTU, htm: MOCK_HTM },
          },
          dpopProofJWS: MOCK_DPOP_PROOF,
        },
      });

      vi.spyOn(dpopValidation, "verifyDPoPProofSignature").mockResolvedValue({
        errors: undefined,
        data: {},
      });

      const validationResult = await toolService.validateDPoPTokenGeneration(
        MOCK_DPOP_PROOF,
        MOCK_HTU,
        bffMockContext
      );

      expect(validationResult).toMatchObject({
        steps: {
          dpopProofValidation: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
            failures: [],
          },
          dpopMatchValidation: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
            failures: [],
          },
          dpopSignatureVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
            failures: [],
          },
        },
      });
    });
  });

  describe("Failure cases", () => {
    it("should handle DPoP structural/claims validation errors", async () => {
      const formatError: ApiError<"invalidDPoPProofFormat"> = {
        code: "invalidDPoPProofFormat",
        message: "Invalid DPoP format",
        detail: "Invalid DPoP format",
        title: "Invalid DPoP Proof Format",
        errors: [],
        name: "ApiError",
      };

      vi.spyOn(dpopValidation, "verifyDPoPProof").mockReturnValue({
        errors: [formatError],
        data: undefined,
      });

      const validationResult = await toolService.validateDPoPTokenGeneration(
        MOCK_DPOP_PROOF,
        MOCK_HTU,
        bffMockContext
      );

      expect(validationResult.steps.dpopProofValidation).toEqual({
        result: bffApi.TokenGenerationValidationStepResult.Enum.FAILED,
        failures: [{ code: formatError.code, reason: formatError.message }],
      });
      expect(validationResult.steps.dpopMatchValidation.result).toBe("SKIPPED");
      expect(validationResult.steps.dpopSignatureVerification.result).toBe(
        "SKIPPED"
      );
    });

    it("should handle HTU mismatch errors", async () => {
      const htuError: ApiError<"dpopProofInvalidClaims"> = {
        code: "dpopProofInvalidClaims",
        message: "HTU mismatch",
        detail: "HTU mismatch",
        title: "Invalid DPoP Proof Claims",
        errors: [],
        name: "ApiError",
      };

      vi.spyOn(dpopValidation, "verifyDPoPProof").mockReturnValue({
        errors: [htuError],
        data: undefined,
      });

      const validationResult = await toolService.validateDPoPTokenGeneration(
        MOCK_DPOP_PROOF,
        "https://wrong-url.it",
        bffMockContext
      );

      expect(validationResult.steps.dpopMatchValidation.result).toBe("FAILED");
      expect(validationResult.steps.dpopSignatureVerification.result).toBe(
        "SKIPPED"
      );
    });

    it("should handle signature verification errors", async () => {
      vi.spyOn(dpopValidation, "verifyDPoPProof").mockReturnValue({
        errors: undefined,
        data: {
          dpopProofJWT: {
            header: {
              alg: "RS256",
              typ: "dpop+jwt",
              jwk: { kty: "RSA", n: "...", e: "..." },
            },
            payload: { jti: "123", iat: 123, htu: MOCK_HTU, htm: MOCK_HTM },
          },
          dpopProofJWS: MOCK_DPOP_PROOF,
        },
      });

      const signatureError: ApiError<"invalidDPoPSignature"> = {
        code: "invalidDPoPSignature",
        message: "Invalid signature",
        detail: "Invalid signature",
        title: "Invalid DPoP Signature",
        errors: [],
        name: "ApiError",
      };

      vi.spyOn(dpopValidation, "verifyDPoPProofSignature").mockResolvedValue({
        errors: [signatureError],
        data: undefined,
      });

      const validationResult = await toolService.validateDPoPTokenGeneration(
        MOCK_DPOP_PROOF,
        MOCK_HTU,
        bffMockContext
      );

      expect(validationResult.steps.dpopSignatureVerification).toEqual({
        result: bffApi.TokenGenerationValidationStepResult.Enum.FAILED,
        failures: [
          { code: signatureError.code, reason: signatureError.message },
        ],
      });
    });
  });
});
