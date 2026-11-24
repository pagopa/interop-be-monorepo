/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AxiosError, AxiosHeaders } from "axios";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  EServiceId,
  EServiceTemplateId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockBffApiCreatedEServiceDescriptor,
  getMockBffApiInstanceEServiceSeed,
} from "../../mockUtils.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /templates/:templateId/eservices", () => {
  const mockInstanceEServiceSeed = getMockBffApiInstanceEServiceSeed();
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService(
    generateId<EServiceId>(),
    generateId<TenantId>(),
    [mockDescriptor]
  );
  const mockApiCreatedEServiceDescriptor =
    getMockBffApiCreatedEServiceDescriptor(mockEService.id, mockDescriptor.id);

  beforeEach(() => {
    clients.catalogProcessClient.createEServiceInstanceFromTemplate = vi
      .fn()
      .mockResolvedValue(mockEService);
  });

  const makeRequest = async (
    token: string,
    templateId: EServiceTemplateId = generateId(),
    body: bffApi.InstanceEServiceSeed = mockInstanceEServiceSeed
  ) =>
    request(api)
      .post(`${appBasePath}/templates/${templateId}/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedEServiceDescriptor);
  });

  it.each([
    { templateId: "invalid" as EServiceTemplateId },
    { body: { ...mockInstanceEServiceSeed, extraField: 1 } },
    { body: { ...mockInstanceEServiceSeed, asyncExchange: false } },
    {
      body: { ...mockInstanceEServiceSeed, isClientAccessDelegable: "invalid" },
    },
    { body: { ...mockInstanceEServiceSeed, isConsumerDelegable: "invalid" } },
    { body: { ...mockInstanceEServiceSeed, isSignalHubEnabled: "invalid" } },
    {
      body: {
        ...mockInstanceEServiceSeed,
        asyncExchangeProperties: { responseTime: "invalid" },
      },
    },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ templateId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        templateId,
        body as bffApi.InstanceEServiceSeed
      );
      expect(res.status).toBe(400);
    }
  );

  describe("identifying word placeholder in error messages", () => {
    const duplicateNameProblem = {
      type: "about:blank",
      title: "Duplicated service name",
      status: 409,
      detail: "An EService with this name already exists",
      correlationId: generateId(),
      errors: [{ code: "001-007", detail: "Duplicated service name" }],
    };

    const makeDuplicateNameError = () =>
      new AxiosError("Conflict", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 409,
        statusText: "Conflict",
        data: duplicateNameProblem,
        headers: {},
        config: { headers: new AxiosHeaders() },
      });

    beforeEach(() => {
      clients.catalogProcessClient.createEServiceInstanceFromTemplate = vi
        .fn()
        .mockRejectedValue(makeDuplicateNameError());
    });

    it("Should replace {identifyingWord} with the instanceLabel of the request", async () => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), {
        ...mockInstanceEServiceSeed,
        instanceLabel: "MyLabel",
      });

      expect(res.status).toBe(409);
      expect(res.body.userMessage).toContain("MyLabel");
      expect(res.body.userMessage).not.toContain("{identifyingWord}");
    });

    it("Should not interpret special replacement patterns contained in the instanceLabel", async () => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), {
        ...mockInstanceEServiceSeed,
        instanceLabel: "$&$1$$",
      });

      expect(res.status).toBe(409);
      expect(res.body.userMessage).toContain("$&$1$$");
      expect(res.body.userMessage).not.toContain("{identifyingWord}");
    });

    it("Should return the problem without userMessage if no instanceLabel is provided", async () => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, generateId(), {
        ...mockInstanceEServiceSeed,
        instanceLabel: undefined,
      });

      expect(res.status).toBe(409);
      expect(res.body.errors).toEqual(duplicateNameProblem.errors);
      expect(res.body.userMessage).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain("{identifyingWord}");
    });
  });
});
