import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  ClientId,
  generateId,
  PurposeId,
} from "pagopa-interop-models";
import { AuthData } from "pagopa-interop-commons";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import { bffApi } from "pagopa-interop-api-clients";
import * as clientAssertionValidation from "pagopa-interop-client-assertion-validation";
import { authorizationApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { toolsServiceBuilder } from "../src/services/toolService.js";
import { getBffMockContext } from "./utils.js";

describe("validateTokenGeneration", () => {
  const MOCK_CLIENT_ID = generateId<ClientId>();
  const MOCK_CLIENT_ASSERTION = "test_client_assertion";
  const MOCK_CLIENT_ASSERTION_TYPE = "test_client_assertion_type";
  const MOCK_GRANT_TYPE = "test_grant_type";
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

  beforeEach(() => {
    setupValidationMocks();
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

  const toolService = toolsServiceBuilder(mockClients);

  describe("Success case", () => {
    it("should validate generated token successfully", async () => {
      const validationResult = await toolService.validateTokenGeneration(
        MOCK_CLIENT_ID,
        MOCK_CLIENT_ASSERTION,
        MOCK_CLIENT_ASSERTION_TYPE,
        MOCK_GRANT_TYPE,
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
        "RS256", // ALLOWED ALGORITHM
        MOCK_CLIENT_ASSERTION_TYPE,
        MOCK_GRANT_TYPE,
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
});
