/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DescriptorId,
  EServiceTemplateId,
  generateId,
  invalidInterfaceContentTypeDetected,
  invalidInterfaceFileDetected,
  interfaceExtractingInfoError,
} from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients, services } from "../../vitest.api.setup.js";
import {
  getMockApiCreatedResource,
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
  const mockEServiceTemplateId = generateId<EServiceTemplateId>();
  const mockTemplateInstanceInterfaceRESTSeed: bffApi.TemplateInstanceInterfaceRESTSeed =
    {
      contactEmail: "email@email.com",
      contactName: "name",
      serverUrls: [],
    };
  const mockApiCreatedResource = getMockApiCreatedResource(mockDescriptorId);

  const makeRequest = async (
    token: string,
    descriptorId: unknown = mockDescriptorId
  ) =>
    request(api)
      .post(
        `${appBasePath}/templates/eservices/${mockEService.id}/descriptors/${descriptorId}/interface/rest`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockTemplateInstanceInterfaceRESTSeed);

  beforeEach(() => {
    clients.catalogProcessClient.addEServiceTemplateInstanceInterfaceRest = vi
      .fn()
      .mockResolvedValue(mockEService);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedResource);
  });

  it.each([
    {
      error: eserviceTemplateNotPublished(mockEServiceTemplateId),
      expectedStatus: 400,
    },
    {
      error: eserviceTemplateNotPublished(mockEServiceTemplateId),
      expectedStatus: 400,
    },
    { error: eserviceIsNotDraft(mockEService.id), expectedStatus: 400 },
    {
      error: eserviceTemplateNotFound(mockEServiceTemplateId),
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
      services.catalogService.addEServiceTemplateInstanceInterfaceSoap = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, "invalid");
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
