/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateId,
  invalidContentTypeDetected,
  invalidInterfaceFileDetected,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, services } from "../../vitest.api.setup.js";
import {
  getMockBffApiCreatedEServiceDescriptor,
  getMockBffApiFileResource,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceDescriptorNotFound,
  invalidZipStructure,
  notValidDescriptor,
} from "../../../src/model/errors.js";
const mockFileResource = getMockBffApiFileResource();
const mockCreatedEServiceDescriptor = getMockBffApiCreatedEServiceDescriptor();

describe("API POST /import/eservices", () => {
  beforeEach(() => {
    services.catalogService.importEService = vi
      .fn()
      .mockResolvedValue(mockCreatedEServiceDescriptor);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.FileResource = mockFileResource
  ) =>
    request(api)
      .post(`${appBasePath}/import/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedEServiceDescriptor);
  });

  it.each([
    {
      error: eserviceDescriptorNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: invalidContentTypeDetected(
        { id: generateId(), isEserviceTemplate: false },
        "contentType",
        "REST"
      ),
      expectedStatus: 400,
    },
    {
      error: invalidInterfaceFileDetected({
        id: generateId(),
        isEserviceTemplate: false,
      }),
      expectedStatus: 400,
    },
    {
      error: notValidDescriptor(generateId(), "state"),
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

  it.each([
    { body: {} },
    { body: { ...mockFileResource, extraField: 1 } },
    { body: { ...mockFileResource, url: "invalid" } },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, body as bffApi.FileResource);
      expect(res.status).toBe(400);
    }
  );
});
