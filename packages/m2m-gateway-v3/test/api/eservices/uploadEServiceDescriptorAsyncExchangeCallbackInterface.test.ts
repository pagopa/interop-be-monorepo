/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { ApiError, generateId } from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  TestMultipartFileUpload,
  addMultipartFileToSupertestRequest,
  fileFromTestMultipartFileUpload,
} from "../../multipartTestUtils.js";

describe("POST /eservices/:eserviceId/descriptors/:descriptorId/asyncExchangeCallbackInterface router test", () => {
  const mockDate = new Date();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const mockFileUpload = {
    fileContent: Buffer.from("test content"),
    filename: "test_callback.yaml",
    contentType: "application/yaml",
    prettyName: "Test Callback Interface",
  };

  const mockM2MEServiceDocumentResponse: m2mGatewayApiV3.Document = {
    id: generateId(),
    prettyName: mockFileUpload.prettyName,
    name: mockFileUpload.filename,
    contentType: mockFileUpload.contentType,
    createdAt: mockDate.toISOString(),
  };

  const makeRequest = async (
    token: string,
    eserviceId: string,
    descriptorId: string,
    file: TestMultipartFileUpload
  ) => {
    const req = request(api)
      .post(
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/asyncExchangeCallbackInterface`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS);

    return addMultipartFileToSupertestRequest(req, file);
  };

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      mockEserviceService.uploadEServiceDescriptorAsyncExchangeCallbackInterface =
        vi.fn().mockResolvedValue(mockM2MEServiceDocumentResponse);

      const token = generateToken(role);
      const eserviceId = generateId();
      const descriptorId = generateId();
      const res = await makeRequest(
        token,
        eserviceId,
        descriptorId,
        mockFileUpload
      );

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MEServiceDocumentResponse);
      expect(
        mockEserviceService.uploadEServiceDescriptorAsyncExchangeCallbackInterface
      ).toHaveBeenCalledWith(
        eserviceId,
        descriptorId,
        expect.objectContaining({
          file: fileFromTestMultipartFileUpload(mockFileUpload),
          prettyName: mockFileUpload.prettyName,
        }),
        expect.any(Object)
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      mockFileUpload
    );
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: new ApiError({
        code: "eServiceNotFound",
        title: "EService not found",
        detail: "EService not found",
      }),
      status: 404,
    },
    {
      error: new ApiError({
        code: "eServiceDescriptorNotFound",
        title: "EService descriptor not found",
        detail: "EService descriptor not found",
      }),
      status: 404,
    },
    {
      error: new ApiError({
        code: "asyncExchangeCallbackInterfaceAlreadyExists",
        title: "Async exchange callback interface already exists",
        detail: "Async exchange callback interface already exists",
      }),
      status: 409,
    },
    {
      error: new ApiError({
        code: "eServiceAsyncExchangeNotEnabled",
        title: "EService async exchange not enabled",
        detail: "EService async exchange not enabled",
      }),
      status: 400,
    },
    {
      error: new ApiError({
        code: "operationForbidden",
        title: "Operation forbidden",
        detail: "Operation forbidden",
      }),
      status: 403,
    },
  ])(
    "Should return $status for mapped catalog-process error $error.code",
    async ({ error, status }) => {
      mockEserviceService.uploadEServiceDescriptorAsyncExchangeCallbackInterface =
        vi.fn().mockRejectedValue(error);

      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        generateId(),
        generateId(),
        mockFileUpload
      );

      expect(res.status).toBe(status);
    }
  );
});
