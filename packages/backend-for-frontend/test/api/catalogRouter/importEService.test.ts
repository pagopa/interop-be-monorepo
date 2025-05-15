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
import {
  getMockApiCreatedEServiceDescriptor,
  getMockApiFileResource,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceDescriptorNotFound,
  invalidZipStructure,
  notValidDescriptor,
} from "../../../src/model/errors.js";
const mockFileResource = getMockApiFileResource();
const mockCreatedEServiceDescriptor = getMockApiCreatedEServiceDescriptor();
const mockEServiceId = generateId<EServiceId>();
const mockDescriptorId = generateId<DescriptorId>();

describe("API POST /import/eservices", () => {
  const makeRequest = async (
    token: string,
    payload: object = mockFileResource
  ) =>
    request(api)
      .post(`${appBasePath}/import/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(payload);

  beforeEach(() => {
    services.catalogService.importEService = vi
      .fn()
      .mockResolvedValue(mockCreatedEServiceDescriptor);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedEServiceDescriptor);
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
    {
      error: invalidInterfaceFileDetected(generateId()),
      expectedStatus: 400,
    },
    {
      error: notValidDescriptor(mockDescriptorId, "state"),
      expectedStatus: 400,
    },
    {
      error: invalidZipStructure(generateId()),
      expectedStatus: 400,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.catalogService.importEService = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {
      ...mockFileResource,
      url: "invalid",
    });
    expect(res.status).toBe(400);
  });
});
