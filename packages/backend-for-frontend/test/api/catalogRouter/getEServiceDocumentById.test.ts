/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { constants } from "http2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId", () => {
  const mockResponse = {
    contentType: "application/octet-stream",
    document: Buffer.from("content"),
  };

  beforeEach(() => {
    services.catalogService.getEServiceDocumentById = vi
      .fn()
      .mockResolvedValue(mockResponse);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    descriptorId: DescriptorId = generateId(),
    documentId: EServiceDocumentId = generateId()
  ) =>
    request(api)
      .get(
        `${appBasePath}/eservices/${eServiceId}/descriptors/${descriptorId}/documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.headers[constants.HTTP2_HEADER_CONTENT_TYPE]).toBe(
      mockResponse.contentType
    );
    expect(res.body).toEqual(mockResponse.document);
  });

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { descriptorId: "invalid" as DescriptorId },
    { documentId: "invalid" as EServiceDocumentId },
  ])(
    "Should return 400 if passed an invalid parameter",
    async ({ eServiceId, descriptorId, documentId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        descriptorId,
        documentId
      );
      expect(res.status).toBe(400);
    }
  );
});
