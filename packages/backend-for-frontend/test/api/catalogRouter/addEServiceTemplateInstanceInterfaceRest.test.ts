/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DescriptorId,
  generateId,
  invalidInterfaceContentTypeDetected,
  invalidInterfaceFileDetected,
  interfaceExtractingInfoError,
  EServiceId,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients, services } from "../../vitest.api.setup.js";
import {
  getMockBffApiCreatedResource,
  getMockBffApiTemplateInstanceInterfaceRESTSeed,
  getMockCatalogApiEService,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  eserviceIsNotDraft,
  eserviceTemplateNotFound,
  eserviceTemplateNotPublished,
} from "../../../src/model/errors.js";

describe("API POST /templates/eservices/:eServiceId/descriptors/:descriptorId/interface/rest", () => {
  const mockEService = getMockCatalogApiEService();
  const mockDescriptorId = generateId<DescriptorId>();
  const mockTemplateInstanceInterfaceRESTSeed =
    getMockBffApiTemplateInstanceInterfaceRESTSeed();
  const mockApiCreatedResource = getMockBffApiCreatedResource(mockDescriptorId);

  beforeEach(() => {
    clients.catalogProcessClient.addEServiceTemplateInstanceInterfaceRest = vi
      .fn()
      .mockResolvedValue(mockEService);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = generateId(),
    descriptorId: DescriptorId = mockDescriptorId,
    body: bffApi.TemplateInstanceInterfaceRESTSeed = mockTemplateInstanceInterfaceRESTSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/templates/eservices/${eServiceId}/descriptors/${descriptorId}/interface/rest`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedResource);
  });

  it.each([
    {
      error: eserviceTemplateNotPublished(generateId()),
      expectedStatus: 400,
    },
    {
      error: eserviceTemplateNotPublished(generateId()),
      expectedStatus: 400,
    },
    { error: eserviceIsNotDraft(mockEService.id), expectedStatus: 400 },
    {
      error: eserviceTemplateNotFound(generateId()),
      expectedStatus: 400,
    },
    {
      error: invalidInterfaceContentTypeDetected(
        mockEService.id,
        "contentType",
        "REST"
      ),
      expectedStatus: 400,
    },
    { error: invalidInterfaceFileDetected(generateId()), expectedStatus: 400 },
    { error: interfaceExtractingInfoError(), expectedStatus: 400 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.catalogService.addEServiceTemplateInstanceInterfaceRest = vi
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
    { body: {} },
    { body: { ...mockTemplateInstanceInterfaceRESTSeed, extraField: 1 } },
    {
      body: {
        ...mockTemplateInstanceInterfaceRESTSeed,
        serverUrls: ["invalid"],
      },
    },
  ])(
    "Should return 400 if passed an invalid data: %s",
    async ({ eServiceId, descriptorId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        descriptorId,
        body as bffApi.TemplateInstanceInterfaceRESTSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
