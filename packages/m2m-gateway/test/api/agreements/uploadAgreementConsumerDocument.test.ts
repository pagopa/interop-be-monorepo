/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockAgreementService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  TestMultipartFileUpload,
  addMultipartFileToSupertestRequest,
} from "../../multipartTestUtils.js";
import { config } from "../../../src/config/config.js";

describe("POST /agreements/:agreementId/consumerDocuments router test", () => {
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

  const mockM2MAgreementDocumentResponse: m2mGatewayApi.Document = {
    id: generateId(),
    prettyName: mockFileUpload.prettyName,
    name: mockFileUpload.filename,
    contentType: mockFileUpload.contentType,
    createdAt: mockDate.toISOString(),
  };

  const makeRequest = async (
    token: string,
    agreementId: string,
    file: TestMultipartFileUpload
  ) => {
    const req = request(api)
      .post(`${appBasePath}/agreements/${agreementId}/consumerDocuments`)
      .set("Authorization", `Bearer ${token}`);

    return addMultipartFileToSupertestRequest(req, file);
  };

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      const agreementId = generateId();
      mockAgreementService.uploadAgreementConsumerDocument = vi
        .fn()
        .mockResolvedValue(mockM2MAgreementDocumentResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, agreementId, mockFileUpload);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MAgreementDocumentResponse);
      expect(
        mockAgreementService.uploadAgreementConsumerDocument
      ).toHaveBeenCalledWith(
        agreementId,
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
    const res = await makeRequest(token, generateId(), mockFileUpload);
    expect(res.status).toBe(403);
  });

  it("Should return 400 for incorrect value for agreement id", async () => {
    mockAgreementService.uploadAgreementConsumerDocument = vi
      .fn()
      .mockResolvedValue(mockM2MAgreementDocumentResponse);

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "INVALID ID", mockFileUpload);
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
        multipartFields as unknown as Parameters<typeof makeRequest>[2]
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
    mockAgreementService.uploadAgreementConsumerDocument = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), mockFileUpload);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MAgreementDocumentResponse, id: "invalidId" },
    { ...mockM2MAgreementDocumentResponse, id: undefined },
    { ...mockM2MAgreementDocumentResponse, name: undefined },
    { ...mockM2MAgreementDocumentResponse, name: 12341 },
    { ...mockM2MAgreementDocumentResponse, contentType: undefined },
    { ...mockM2MAgreementDocumentResponse, prettyName: undefined },
    { ...mockM2MAgreementDocumentResponse, createdAt: undefined },
    { ...mockM2MAgreementDocumentResponse, createdAt: "invalidDate" },
    { ...mockM2MAgreementDocumentResponse, invalidParam: "invalidValue" },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockAgreementService.uploadAgreementConsumerDocument = vi
        .fn()
        .mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), mockFileUpload);

      expect(res.status).toBe(500);
    }
  );
});
