import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  TestMultipartFileUpload,
  addMultipartFileToSupertestRequest,
  fileFromTestMultipartFileUpload,
} from "../../multipartTestUtils.js";
import { config } from "../../../src/config/config.js";

describe("POST /eserviceTemplates/:templateId/versions/:versionId/documents router test", () => {
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
    filename: "test_document.pdf",
    contentType: "application/pdf",
    prettyName: "Test Document",
  };

  const mockM2MEServiceTemplateDocumentResponse: m2mGatewayApi.Document = {
    id: generateId(),
    prettyName: mockFileUpload.prettyName,
    name: mockFileUpload.filename,
    contentType: mockFileUpload.contentType,
    createdAt: new Date().toISOString(),
  };

  const makeRequest = async (
    token: string,
    templateId: string,
    versionId: string,
    file: TestMultipartFileUpload
  ) => {
    const req = request(api)
      .post(
        `${appBasePath}/eserviceTemplates/${templateId}/versions/${versionId}/documents`
      )
      .set("Authorization", `Bearer ${token}`);

    return addMultipartFileToSupertestRequest(req, file);
  };

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      const templateId = generateId();
      const versionId = generateId();
      mockEServiceTemplateService.uploadEServiceTemplateVersionDocument = vi
        .fn()
        .mockResolvedValue(mockM2MEServiceTemplateDocumentResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        templateId,
        versionId,
        mockFileUpload
      );

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MEServiceTemplateDocumentResponse);
      expect(
        mockEServiceTemplateService.uploadEServiceTemplateVersionDocument
      ).toHaveBeenCalledWith(
        templateId,
        versionId,
        {
          file: fileFromTestMultipartFileUpload(mockFileUpload, mockDate),
          prettyName: mockFileUpload.prettyName,
        },
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

  it("Should return 400 for incorrect value for eservice template id", async () => {
    mockEServiceTemplateService.uploadEServiceTemplateVersionDocument = vi
      .fn()
      .mockResolvedValue(mockM2MEServiceTemplateDocumentResponse);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(
      token,
      "INVALID ID",
      generateId(),
      mockFileUpload
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for version id", async () => {
    mockEServiceTemplateService.uploadEServiceTemplateVersionDocument = vi
      .fn()
      .mockResolvedValue(mockM2MEServiceTemplateDocumentResponse);

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
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEServiceTemplateService.uploadEServiceTemplateVersionDocument = vi
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
    { ...mockM2MEServiceTemplateDocumentResponse, id: "invalidId" },
    { ...mockM2MEServiceTemplateDocumentResponse, id: undefined },
    { ...mockM2MEServiceTemplateDocumentResponse, name: undefined },
    { ...mockM2MEServiceTemplateDocumentResponse, name: 12341 },
    { ...mockM2MEServiceTemplateDocumentResponse, contentType: undefined },
    { ...mockM2MEServiceTemplateDocumentResponse, prettyName: undefined },
    { ...mockM2MEServiceTemplateDocumentResponse, createdAt: undefined },
    { ...mockM2MEServiceTemplateDocumentResponse, createdAt: "invalidDate" },
    {
      ...mockM2MEServiceTemplateDocumentResponse,
      invalidParam: "invalidValue",
    },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEServiceTemplateService.uploadEServiceTemplateVersionDocument = vi
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
