/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DescriptorId,
  EServiceId,
  generateId,
  invalidInterfaceContentTypeDetected,
  invalidInterfaceFileDetected,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockApiCreatedResource } from "../../mockUtils.js";
import { eserviceDescriptorNotFound } from "../../../src/model/errors.js";

describe("API POST /eservices/:eServiceId/descriptors/:descriptorId/documents", () => {
  const mockEServiceId = generateId<EServiceId>();
  const mockDescriptorId = generateId<DescriptorId>();
  const mockApiCreatedResource = getMockApiCreatedResource();

  const makeRequest = async (
    token: string,
    descriptorId: unknown = mockDescriptorId
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/${mockEServiceId}/descriptors/${descriptorId}/documents`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .field("kind", "DOCUMENT")
      .field("prettyName", "prettyName")
      .attach("doc", Buffer.from("content"), { filename: "doc.txt" });

  beforeEach(() => {
    services.catalogService.createEServiceDocument = vi
      .fn()
      .mockResolvedValue(mockApiCreatedResource);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedResource);
  });

  it.each([
    {
      error: eserviceDescriptorNotFound(mockEServiceId, mockDescriptorId),
      expectedStatus: 404,
    },
    {
      error: invalidInterfaceContentTypeDetected(
        mockEServiceId,
        "contentType",
        "REST"
      ),
      expectedStatus: 400,
    },
    { error: invalidInterfaceFileDetected(generateId()), expectedStatus: 400 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.catalogService.createEServiceDocument = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
