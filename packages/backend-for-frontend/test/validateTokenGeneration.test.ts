import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  ClientId,
  featureFlagNotEnabled,
  generateId,
  PurposeId,
} from "pagopa-interop-models";
import { AuthData } from "pagopa-interop-commons";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { authorizationApi, bffApi } from "pagopa-interop-api-clients";
import * as clientAssertionValidation from "pagopa-interop-client-assertion-validation";
import * as dpopValidation from "pagopa-interop-dpop-validation";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { config } from "../src/config/config.js";
import { toolsServiceBuilder } from "../src/services/toolService.js";
import { getBffMockContext } from "./utils.js";

describe("validateTokenGeneration", () => {
  const MOCK_CLIENT_ID = generateId<ClientId>();
  const MOCK_CLIENT_ASSERTION = "test_client_assertion";
  const MOCK_CLIENT_ASSERTION_TYPE = "test_client_assertion_type";
  const MOCK_GRANT_TYPE = "test_grant_type";
  const MOCK_DPOP_PROOF = "test_dpop_proof_jws";
  const MOCK_KID = "kid123";
  const MOCK_PURPOSE_ID = generateId<PurposeId>();
  const MOCK_JWT_PAYLOAD = {
    sub: MOCK_CLIENT_ID,
    jti: "jti123",
    iat: 1234567890,
    exp: 9999999999,
    iss: MOCK_CLIENT_ID,
    aud: ["audience"],
    purposeId: MOCK_PURPOSE_ID,
    digest: { alg: "SHA256", value: "0".repeat(64) },
  };

  const mockAuthData: AuthData = {
    ...getMockAuthData(),
    organizationId: generateId(),
  };

  const bffMockContext = getBffMockContext(
    getMockContext({ authData: mockAuthData })
  );

  const mockClients = {
    agreementProcessClient: {
      addAgreementConsumerDocument: vi.fn().mockResolvedValue({}),
    },
    authorizationClient: {
      token: {
        getKeyWithClientByKeyId: vi.fn().mockResolvedValue({
          client: {
            consumerId: mockAuthData.organizationId,
            kind: authorizationApi.ClientKind.enum.API,
          },
        }),
      },
      client: {
        getClientKeyById: vi.fn().mockResolvedValue({}),
      },
    },
  } as unknown as PagoPAInteropBeClients;

  const toolService = toolsServiceBuilder(mockClients);

  beforeEach(() => {
    vi.restoreAllMocks();
    setupValidationMocks();
    config.featureFlagDpopClientAssertionDebugger = false;
  });

  function setupValidationMocks(): void {
    vi.spyOn(
      clientAssertionValidation,
      "validateRequestParameters"
    ).mockReturnValue({
      errors: undefined,
      data: {
        client_assertion: MOCK_CLIENT_ASSERTION,
        client_assertion_type: MOCK_CLIENT_ASSERTION_TYPE,
        grant_type: MOCK_GRANT_TYPE,
        client_id: MOCK_CLIENT_ID,
      },
    });

    vi.spyOn(
      clientAssertionValidation,
      "verifyClientAssertion"
    ).mockReturnValue({
      errors: undefined,
      data: {
        header: { kid: MOCK_KID, alg: "RS256", typ: "JWT" },
        payload: MOCK_JWT_PAYLOAD,
      },
    });

    vi.spyOn(
      clientAssertionValidation,
      "verifyClientAssertionSignature"
    ).mockResolvedValue({
      errors: undefined,
      data: {
        ...MOCK_JWT_PAYLOAD,
        purposeId: "purpose-id-123",
      },
    });
  }

  describe("Success case", () => {
    it("should validate generated token successfully", async () => {
      const validationResult = await toolService.validateTokenGeneration(
        MOCK_CLIENT_ID,
        MOCK_CLIENT_ASSERTION,
        MOCK_CLIENT_ASSERTION_TYPE,
        MOCK_GRANT_TYPE,
        undefined,
        bffMockContext
      );

      expect(validationResult).toMatchObject({
        eservice: undefined,
        steps: {
          clientAssertionValidation: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
            failures: [],
          },
          publicKeyRetrieve: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
            failures: [],
          },
          clientAssertionSignatureVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
            failures: [],
          },
          platformStatesVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
            failures: [],
          },
        },
      });
    });
  });

  describe("Failure cases", () => {
    it("should handle parameters validation errors", async () => {
      const parameterValidationError: ApiError<"invalidAssertionType"> = {
        code: "invalidAssertionType",
        title: "Invalid assertion type",
        detail: `Assertion type ${MOCK_CLIENT_ASSERTION_TYPE} is invalid. Expected: urn:ietf:params:oauth:client-assertion-type:jwt-bearer`,
        name: "Error",
        message: `Assertion type ${MOCK_CLIENT_ASSERTION_TYPE} is invalid. Expected: urn:ietf:params:oauth:client-assertion-type:jwt-bearer`,
        errors: [],
      };

      const formatValidationError: ApiError<"invalidClientAssertionFormat"> = {
        code: "invalidClientAssertionFormat",
        title: "Invalid Client Assertion Format",
        detail: "Invalid format for Client assertion: Invalid JWT",
        name: "Error",
        message: "Invalid format for Client assertion: Invalid JWT",
        errors: [],
      };

      vi.spyOn(
        clientAssertionValidation,
        "validateRequestParameters"
      ).mockReturnValue({
        errors: [parameterValidationError],
        data: undefined,
      });

      vi.spyOn(
        clientAssertionValidation,
        "verifyClientAssertion"
      ).mockReturnValue({
        errors: [formatValidationError],
        data: undefined,
      });

      const validationResult = await toolService.validateTokenGeneration(
        MOCK_CLIENT_ID,
        MOCK_CLIENT_ASSERTION,
        MOCK_CLIENT_ASSERTION_TYPE,
        MOCK_GRANT_TYPE,
        undefined,
        bffMockContext
      );

      expect(validationResult).toEqual({
        clientKind: undefined,
        eservice: undefined,
        steps: {
          clientAssertionValidation: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.FAILED,
            failures: [
              {
                code: parameterValidationError.code,
                reason: parameterValidationError.message,
              },
              {
                code: formatValidationError.code,
                reason: formatValidationError.message,
              },
            ],
          },
          publicKeyRetrieve: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.SKIPPED,
            failures: [],
          },
          clientAssertionSignatureVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.SKIPPED,
            failures: [],
          },
          platformStatesVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.SKIPPED,
            failures: [],
          },
        },
      });

      expect(
        clientAssertionValidation.validateRequestParameters
      ).toHaveBeenCalledWith({
        client_assertion: MOCK_CLIENT_ASSERTION,
        client_assertion_type: MOCK_CLIENT_ASSERTION_TYPE,
        grant_type: MOCK_GRANT_TYPE,
        client_id: MOCK_CLIENT_ID,
      });
    });

    it("should handle only parameters validation errors", async () => {
      const parameterValidationError: ApiError<"invalidAssertionType"> = {
        code: "invalidAssertionType",
        title: "Invalid assertion type",
        detail: `Assertion type ${MOCK_CLIENT_ASSERTION_TYPE} is invalid. Expected: urn:ietf:params:oauth:client-assertion-type:jwt-bearer`,
        name: "Error",
        message: `Assertion type ${MOCK_CLIENT_ASSERTION_TYPE} is invalid. Expected: urn:ietf:params:oauth:client-assertion-type:jwt-bearer`,
        errors: [],
      };

      vi.spyOn(
        clientAssertionValidation,
        "validateRequestParameters"
      ).mockReturnValue({
        errors: [parameterValidationError],
        data: undefined,
      });

      vi.spyOn(
        clientAssertionValidation,
        "verifyClientAssertion"
      ).mockReturnValue({
        errors: undefined,
        data: {
          header: { kid: MOCK_KID, alg: "RS256", typ: "JWT" },
          payload: MOCK_JWT_PAYLOAD,
        },
      });

      const validationResult = await toolService.validateTokenGeneration(
        MOCK_CLIENT_ID,
        MOCK_CLIENT_ASSERTION,
        MOCK_CLIENT_ASSERTION_TYPE,
        MOCK_GRANT_TYPE,
        undefined,
        bffMockContext
      );

      expect(validationResult).toEqual({
        clientKind: undefined,
        eservice: undefined,
        steps: {
          clientAssertionValidation: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.FAILED,
            failures: [
              {
                code: parameterValidationError.code,
                reason: parameterValidationError.message,
              },
            ],
          },
          publicKeyRetrieve: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.SKIPPED,
            failures: [],
          },
          clientAssertionSignatureVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.SKIPPED,
            failures: [],
          },
          platformStatesVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.SKIPPED,
            failures: [],
          },
        },
      });
    });

    it("should handle only client assertion validation errors", async () => {
      const formatValidationError: ApiError<"invalidClientAssertionFormat"> = {
        code: "invalidClientAssertionFormat",
        title: "Invalid Client Assertion Format",
        detail: "Invalid format for Client assertion: Invalid JWT",
        name: "Error",
        message: "Invalid format for Client assertion: Invalid JWT",
        errors: [],
      };

      vi.spyOn(
        clientAssertionValidation,
        "validateRequestParameters"
      ).mockReturnValue({
        errors: undefined,
        data: {
          client_assertion: MOCK_CLIENT_ASSERTION,
          client_assertion_type: MOCK_CLIENT_ASSERTION_TYPE,
          grant_type: MOCK_GRANT_TYPE,
          client_id: MOCK_CLIENT_ID,
        },
      });

      vi.spyOn(
        clientAssertionValidation,
        "verifyClientAssertion"
      ).mockReturnValue({
        errors: [formatValidationError],
        data: undefined,
      });

      const validationResult = await toolService.validateTokenGeneration(
        MOCK_CLIENT_ID,
        MOCK_CLIENT_ASSERTION,
        MOCK_CLIENT_ASSERTION_TYPE,
        MOCK_GRANT_TYPE,
        undefined,
        bffMockContext
      );

      expect(validationResult).toEqual({
        clientKind: undefined,
        eservice: undefined,
        steps: {
          clientAssertionValidation: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.FAILED,
            failures: [
              {
                code: formatValidationError.code,
                reason: formatValidationError.message,
              },
            ],
          },
          publicKeyRetrieve: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.SKIPPED,
            failures: [],
          },
          clientAssertionSignatureVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.SKIPPED,
            failures: [],
          },
          platformStatesVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.SKIPPED,
            failures: [],
          },
        },
      });
    });

    it("should handle validation results when key retrieve errors", async () => {
      const clientsWithKeyRetrieveError = {
        agreementProcessClient: {
          addAgreementConsumerDocument: vi.fn().mockResolvedValue({}),
        },
        authorizationClient: {
          token: {
            getKeyWithClientByKeyId: vi.fn().mockResolvedValue(undefined),
          },
        },
      } as unknown as PagoPAInteropBeClients;

      const toolServiceWithKeyError = toolsServiceBuilder(
        clientsWithKeyRetrieveError
      );

      const validationResult =
        await toolServiceWithKeyError.validateTokenGeneration(
          MOCK_CLIENT_ID,
          MOCK_CLIENT_ASSERTION,
          MOCK_CLIENT_ASSERTION_TYPE,
          MOCK_GRANT_TYPE,
          undefined,
          bffMockContext
        );

      expect(validationResult).toEqual({
        clientKind: undefined,
        eservice: undefined,
        steps: {
          clientAssertionValidation: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
            failures: [],
          },
          publicKeyRetrieve: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.FAILED,
            failures: [
              {
                code: "clientAssertionPublicKeyNotFound",
                reason: expect.stringContaining(
                  `Public key with kid ${MOCK_KID} not found for client ${MOCK_CLIENT_ID}`
                ),
              },
            ],
          },
          clientAssertionSignatureVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.SKIPPED,
            failures: [],
          },
          platformStatesVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.SKIPPED,
            failures: [],
          },
        },
      });
    });

    it("should handle client assertion signature verification errors", async () => {
      const signatureVerificationError: ApiError<"invalidSignature"> = {
        code: "invalidSignature",
        title: "Invalid Signature",
        detail: "Client assertion signature is invalid",
        message: "Client assertion signature is invalid",
        name: "Error",
        errors: [],
      };

      vi.spyOn(
        clientAssertionValidation,
        "verifyClientAssertionSignature"
      ).mockResolvedValue({
        errors: [signatureVerificationError],
        data: undefined,
      });

      const validationResult = await toolService.validateTokenGeneration(
        MOCK_CLIENT_ID,
        "RS256",
        MOCK_CLIENT_ASSERTION_TYPE,
        MOCK_GRANT_TYPE,
        undefined,
        bffMockContext
      );

      expect(validationResult).toEqual({
        clientKind: authorizationApi.ClientKind.enum.API,
        eservice: undefined,
        steps: {
          clientAssertionValidation: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
            failures: [],
          },
          publicKeyRetrieve: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
            failures: [],
          },
          clientAssertionSignatureVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.FAILED,
            failures: [
              {
                code: signatureVerificationError.code,
                reason: signatureVerificationError.message,
              },
            ],
          },
          platformStatesVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.SKIPPED,
            failures: [],
          },
        },
      });
    });

    it("should handle platform state verification errors", async () => {
      const platformStateError =
        clientAssertionValidation.invalidPurposeState("INACTIVE");

      vi.spyOn(
        clientAssertionValidation,
        "validateClientKindAndPlatformState"
      ).mockReturnValue({
        errors: [platformStateError],
        data: undefined,
      });

      const validationResult = await toolService.validateTokenGeneration(
        MOCK_CLIENT_ID,
        MOCK_CLIENT_ASSERTION,
        MOCK_CLIENT_ASSERTION_TYPE,
        MOCK_GRANT_TYPE,
        undefined,
        bffMockContext
      );

      expect(validationResult).toEqual({
        clientKind: authorizationApi.ClientKind.enum.API,
        eservice: undefined,
        steps: {
          clientAssertionValidation: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
            failures: [],
          },
          publicKeyRetrieve: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
            failures: [],
          },
          clientAssertionSignatureVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
            failures: [],
          },
          platformStatesVerification: {
            result: bffApi.TokenGenerationValidationStepResult.Enum.FAILED,
            failures: [
              {
                code: platformStateError.code,
                reason: platformStateError.message,
              },
            ],
          },
        },
      });
    });
  });

  describe("DPoP validation", () => {
    beforeEach(() => {
      config.featureFlagDpopClientAssertionDebugger = true;
    });

    it("should fail when DPoP proof is provided and the DPoP debugger feature flag is disabled", async () => {
      config.featureFlagDpopClientAssertionDebugger = false;

      const verifyDPoPProofSpy = vi.spyOn(dpopValidation, "verifyDPoPProof");
      const verifyDPoPProofSignatureSpy = vi.spyOn(
        dpopValidation,
        "verifyDPoPProofSignature"
      );

      await expect(
        toolService.validateTokenGeneration(
          MOCK_CLIENT_ID,
          MOCK_CLIENT_ASSERTION,
          MOCK_CLIENT_ASSERTION_TYPE,
          MOCK_GRANT_TYPE,
          MOCK_DPOP_PROOF,
          bffMockContext
        )
      ).rejects.toThrowError(
        featureFlagNotEnabled("featureFlagDpopClientAssertionDebugger")
      );
      expect(verifyDPoPProofSpy).not.toHaveBeenCalled();
      expect(verifyDPoPProofSignatureSpy).not.toHaveBeenCalled();
    });

    it("should validate token generation and DPoP proof together", async () => {
      vi.spyOn(dpopValidation, "verifyDPoPProof").mockReturnValue({
        errors: undefined,
        data: {
          dpopProofJWT: {
            header: {
              alg: "RS256",
              typ: "dpop+jwt",
              jwk: { kty: "RSA", n: "...", e: "..." },
            },
            payload: {
              jti: "123",
              iat: 123,
              htu: config.dpopHtuBase,
              htm: "POST",
            },
          },
          dpopProofJWS: MOCK_DPOP_PROOF,
        },
      });

      vi.spyOn(dpopValidation, "verifyDPoPProofSignature").mockResolvedValue({
        errors: undefined,
        data: {},
      });

      const validationResult = await toolService.validateTokenGeneration(
        MOCK_CLIENT_ID,
        MOCK_CLIENT_ASSERTION,
        MOCK_CLIENT_ASSERTION_TYPE,
        MOCK_GRANT_TYPE,
        MOCK_DPOP_PROOF,
        bffMockContext
      );

      expect(validationResult.steps).toMatchObject({
        clientAssertionValidation: {
          result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
          failures: [],
        },
        publicKeyRetrieve: {
          result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
          failures: [],
        },
        clientAssertionSignatureVerification: {
          result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
          failures: [],
        },
        platformStatesVerification: {
          result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
          failures: [],
        },
        dpopValidation: {
          result: bffApi.TokenGenerationValidationStepResult.Enum.PASSED,
          failures: [],
        },
      });

      expect(dpopValidation.verifyDPoPProof).toHaveBeenCalledWith({
        dpopProofJWS: MOCK_DPOP_PROOF,
        expectedDPoPProofHtu: config.dpopHtuBase,
        expectedDPoPProofHtm: "POST",
        dpopProofIatToleranceSeconds: config.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: config.dpopDurationSeconds,
      });
    });

    it("should include DPoP validation when client assertion validation fails", async () => {
      const parameterValidationError: ApiError<"invalidAssertionType"> = {
        code: "invalidAssertionType",
        title: "Invalid assertion type",
        detail: "Invalid assertion type",
        name: "Error",
        message: "Invalid assertion type",
        errors: [],
      };
      const dpopFormatError: ApiError<"invalidDPoPProofFormat"> = {
        code: "invalidDPoPProofFormat",
        title: "Invalid DPoP Proof Format",
        detail: "Invalid DPoP format",
        name: "Error",
        message: "Invalid DPoP format",
        errors: [],
      };

      vi.spyOn(
        clientAssertionValidation,
        "validateRequestParameters"
      ).mockReturnValue({
        errors: [parameterValidationError],
        data: undefined,
      });

      vi.spyOn(dpopValidation, "verifyDPoPProof").mockReturnValue({
        errors: [dpopFormatError],
        data: undefined,
      });

      const validationResult = await toolService.validateTokenGeneration(
        MOCK_CLIENT_ID,
        MOCK_CLIENT_ASSERTION,
        MOCK_CLIENT_ASSERTION_TYPE,
        MOCK_GRANT_TYPE,
        MOCK_DPOP_PROOF,
        bffMockContext
      );

      expect(validationResult.steps.clientAssertionValidation).toEqual({
        result: bffApi.TokenGenerationValidationStepResult.Enum.FAILED,
        failures: [
          {
            code: parameterValidationError.code,
            reason: parameterValidationError.message,
          },
        ],
      });
      expect(validationResult.steps.dpopValidation).toEqual({
        result: bffApi.TokenGenerationValidationStepResult.Enum.FAILED,
        failures: [
          {
            code: dpopFormatError.code,
            reason: dpopFormatError.message,
          },
        ],
      });
    });

    it("should classify HTU mismatch as DPoP match validation failure", async () => {
      const htuError: ApiError<"invalidDPoPHtu"> = {
        code: "invalidDPoPHtu",
        message: "HTU mismatch",
        detail: "HTU mismatch",
        title: "Invalid HTU in DPoP proof",
        errors: [],
        name: "ApiError",
      };

      vi.spyOn(dpopValidation, "verifyDPoPProof").mockReturnValue({
        errors: [htuError],
        data: undefined,
      });

      const validationResult = await toolService.validateTokenGeneration(
        MOCK_CLIENT_ID,
        MOCK_CLIENT_ASSERTION,
        MOCK_CLIENT_ASSERTION_TYPE,
        MOCK_GRANT_TYPE,
        MOCK_DPOP_PROOF,
        bffMockContext
      );

      expect(validationResult.steps.dpopValidation).toEqual({
        result: bffApi.TokenGenerationValidationStepResult.Enum.FAILED,
        failures: [{ code: htuError.code, reason: htuError.message }],
      });
    });

    it("should handle DPoP signature verification errors", async () => {
      const signatureError: ApiError<"invalidDPoPSignature"> = {
        code: "invalidDPoPSignature",
        message: "Invalid signature",
        detail: "Invalid signature",
        title: "Invalid DPoP Signature",
        errors: [],
        name: "ApiError",
      };

      vi.spyOn(dpopValidation, "verifyDPoPProof").mockReturnValue({
        errors: undefined,
        data: {
          dpopProofJWT: {
            header: {
              alg: "RS256",
              typ: "dpop+jwt",
              jwk: { kty: "RSA", n: "...", e: "..." },
            },
            payload: {
              jti: "123",
              iat: 123,
              htu: config.dpopHtuBase,
              htm: "POST",
            },
          },
          dpopProofJWS: MOCK_DPOP_PROOF,
        },
      });

      vi.spyOn(dpopValidation, "verifyDPoPProofSignature").mockResolvedValue({
        errors: [signatureError],
        data: undefined,
      });

      const validationResult = await toolService.validateTokenGeneration(
        MOCK_CLIENT_ID,
        MOCK_CLIENT_ASSERTION,
        MOCK_CLIENT_ASSERTION_TYPE,
        MOCK_GRANT_TYPE,
        MOCK_DPOP_PROOF,
        bffMockContext
      );

      expect(validationResult.steps.dpopValidation).toEqual({
        result: bffApi.TokenGenerationValidationStepResult.Enum.FAILED,
        failures: [
          { code: signatureError.code, reason: signatureError.message },
        ],
      });
    });
  });
});
