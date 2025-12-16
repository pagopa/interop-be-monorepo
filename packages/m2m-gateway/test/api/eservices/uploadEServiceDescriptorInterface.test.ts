/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import {
  generateId,
  interfaceExtractingInfoError,
  interfaceExtractingSoapFiledError,
  invalidContentTypeDetected,
  invalidInterfaceFileDetected,
  invalidServerUrl,
  openapiVersionNotRecognized,
  parsingSoapFileError,
  pollingMaxRetriesExceeded,
} from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockEserviceService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  TestMultipartFileUpload,
  addMultipartFileToSupertestRequest,
} from "../../multipartTestUtils.js";
import { config } from "../../../src/config/config.js";

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

  const mockM2MEServiceDocumentResponse: m2mGatewayApi.Document = {
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
      .set("Authorization", `Bearer ${token}`);

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
      error: invalidContentTypeDetected(
        {
          id: generateId(),
          isEserviceTemplate: true,
        },
        "contentType",
        "REST"
      ),
      expectedStatus: 400,
    },
    {
      error: invalidInterfaceFileDetected({
        id: generateId(),
        isEserviceTemplate: true,
      }),
      expectedStatus: 400,
    },
    {
      error: interfaceExtractingSoapFiledError("invalid-field"),
      expectedStatus: 400,
    },
    {
      error: interfaceExtractingInfoError(),
      expectedStatus: 400,
    },
    {
      error: parsingSoapFileError(),
      expectedStatus: 400,
    },
    {
      error: openapiVersionNotRecognized("invalid-version"),
      expectedStatus: 400,
    },
    {
      error: invalidServerUrl({
        id: generateId(),
        isEserviceTemplate: true,
      }),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus in case of $error",
    async ({ error, expectedStatus }) => {
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

      expect(res.status).toBe(expectedStatus);
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
