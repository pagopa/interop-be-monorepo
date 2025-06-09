/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DescriptorId,
  EServiceId,
  EServiceTemplateId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiFileResource } from "../../mockUtils.js";
import {
  eserviceDescriptorNotFound,
  invalidEServiceRequester,
  notValidDescriptor,
  templateInstanceNotAllowed,
} from "../../../src/model/errors.js";

describe("API GET /export/eservices/:eserviceId/descriptors/:descriptorId", () => {
  const mockFileResource = getMockBffApiFileResource();

  beforeEach(() => {
    services.catalogService.exportEServiceDescriptor = vi
      .fn()
      .mockResolvedValue(mockFileResource);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    descriptorId: DescriptorId = generateId()
  ) =>
    request(api)
      .get(
        `${appBasePath}/export/eservices/${eServiceId}/descriptors/${descriptorId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockFileResource);
  });

  it.each([
    {
      error: eserviceDescriptorNotFound(
        generateId(),
        generateId<DescriptorId>()
      ),
      expectedStatus: 404,
    },
    {
      error: notValidDescriptor(generateId(), ""),
      expectedStatus: 400,
    },
    {
      error: invalidEServiceRequester(generateId(), generateId<TenantId>()),
      expectedStatus: 403,
    },
    {
      error: templateInstanceNotAllowed(
        generateId(),
        generateId<EServiceTemplateId>()
      ),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.catalogService.exportEServiceDescriptor = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { descriptorId: "invalid" as DescriptorId },
  ])(
    "Should return 400 if passed an invalid parameter",
    async ({ eServiceId, descriptorId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eServiceId, descriptorId);
      expect(res.status).toBe(400);
    }
  );
});
