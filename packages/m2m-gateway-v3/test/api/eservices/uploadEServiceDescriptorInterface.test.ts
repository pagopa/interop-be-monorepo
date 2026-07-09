/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import {
  ApiError,
  generateId,
  pollingMaxRetriesExceeded,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  TestMultipartFileUpload,
  addMultipartFileToSupertestRequest,
} from "../../multipartTestUtils.js";
import { api, mockEserviceService } from "../../vitest.api.setup.js";

describe("POST /eservices/:eserviceId/descriptors/:descriptorId/interface router test", () => {
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
    filename: "test_document.yaml",
    contentType: "application/yaml",
    prettyName: "Test Interface",
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
        `${appBasePath}/eservices/${eserviceId}/descriptors/${descriptorId}/interface`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS);

    return addMultipartFileToSupertestRequest(req, file);
  };

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      const eserviceId = generateId();
      const descriptorId = generateId();
      mockEserviceService.uploadEServiceDescriptorInterface = vi
        .fn()
        .mockResolvedValue(mockM2MEServiceDocumentResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        eserviceId,
        descriptorId,
        mockFileUpload
      );

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MEServiceDocumentResponse);
      expect(
        mockEserviceService.uploadEServiceDescriptorInterface
      ).toHaveBeenCalledWith(
        eserviceId,
        descriptorId,
        expect.objectContaining({
          file: expect.any(File),
          prettyName: mockFileUpload.prettyName,
        }),
        expect.any(Object) // Context object
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

  it("Should return 400 for incorrect value for eservice id", async () => {
    mockEserviceService.uploadEServiceDescriptorInterface = vi
      .fn()
      .mockResolvedValue(mockM2MEServiceDocumentResponse);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(
      token,
      "INVALID ID",
      generateId(),
      mockFileUpload
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for descriptor id", async () => {
    mockEserviceService.uploadEServiceDescriptorInterface = vi
      .fn()
      .mockResolvedValue(mockM2MEServiceDocumentResponse);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      "INVALID ID",
      mockFileUpload
    );
    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockFileUpload, fileContent: undefined },
    { ...mockFileUpload, filename: undefined },
    { ...mockFileUpload, prettyName: undefined },
  ])(
    "Should return 400 if passed an invalid multipart body",
    async (multipartFields) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        generateId(),
        generateId(),
        multipartFields as TestMultipartFileUpload
      );

      expect(res.status).toBe(400);
    }
  );

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
        code: "notValidDescriptor",
        title: "Not valid descriptor",
        detail: "Not valid descriptor",
      }),
      status: 409,
    },
    {
      error: new ApiError({
        code: "interfaceAlreadyExists",
        title: "Interface already exists",
        detail: "Interface already exists",
      }),
      status: 409,
    },
    {
      error: new ApiError({
        code: "templateInstanceNotAllowed",
        title: "Template instance not allowed",
        detail: "Template instance not allowed",
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
      mockEserviceService.uploadEServiceDescriptorInterface = vi
        .fn()
        .mockRejectedValue(error);

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

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEserviceService.uploadEServiceDescriptorInterface = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      mockFileUpload
    );

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MEServiceDocumentResponse, id: "invalidId" },
    { ...mockM2MEServiceDocumentResponse, id: undefined },
    { ...mockM2MEServiceDocumentResponse, name: undefined },
    { ...mockM2MEServiceDocumentResponse, name: 12341 },
    { ...mockM2MEServiceDocumentResponse, contentType: undefined },
    { ...mockM2MEServiceDocumentResponse, prettyName: undefined },
    { ...mockM2MEServiceDocumentResponse, createdAt: undefined },
    { ...mockM2MEServiceDocumentResponse, createdAt: "invalidDate" },
    { ...mockM2MEServiceDocumentResponse, invalidParam: "invalidValue" },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEserviceService.uploadEServiceDescriptorInterface = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        generateId(),
        generateId(),
        mockFileUpload
      );

      expect(res.status).toBe(500);
    }
  );
});
