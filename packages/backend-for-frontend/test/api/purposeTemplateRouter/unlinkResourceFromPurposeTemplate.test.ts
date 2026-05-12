import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { bffApi } from "pagopa-interop-api-clients";
import { generateToken } from "pagopa-interop-commons-test/src/mockedPayloadForToken.js";
import { authRole } from "pagopa-interop-commons";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /purposeTemplates/:purposeTemplateId/unlinkResource", () => {
  const mockPurposeTemplateId = generateId();
  const mockEServiceId = generateId();
  const mockEServiceTemplateId = generateId();

  beforeEach(() => {
    clients.purposeTemplateProcessClient.unlinkEServicesFromPurposeTemplate = vi
      .fn()
      .mockResolvedValue(undefined);
    clients.purposeTemplateProcessClient.unlinkEServiceTemplatesFromPurposeTemplate =
      vi.fn().mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.LinkableResourceRequest,
    purposeTemplateId: string = mockPurposeTemplateId
  ): Promise<request.Response> =>
    request(api)
      .post(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/unlinkResource`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 dispatching to concrete unlink for ESERVICE resourceKind", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {
      resourceKind: "ESERVICE",
      eserviceId: mockEServiceId,
    });
    expect(res.status).toBe(204);
    expect(
      clients.purposeTemplateProcessClient.unlinkEServicesFromPurposeTemplate
    ).toHaveBeenCalledTimes(1);
    expect(
      clients.purposeTemplateProcessClient.unlinkEServicesFromPurposeTemplate
    ).toHaveBeenCalledWith(
      { eserviceIds: [mockEServiceId] },
      expect.objectContaining({ params: { id: mockPurposeTemplateId } })
    );
    expect(
      clients.purposeTemplateProcessClient
        .unlinkEServiceTemplatesFromPurposeTemplate
    ).toHaveBeenCalledTimes(0);
  });

  it("Should return 204 dispatching to template unlink for ESERVICE_TEMPLATE resourceKind", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {
      resourceKind: "ESERVICE_TEMPLATE",
      eserviceTemplateId: mockEServiceTemplateId,
    });
    expect(res.status).toBe(204);
    expect(
      clients.purposeTemplateProcessClient
        .unlinkEServiceTemplatesFromPurposeTemplate
    ).toHaveBeenCalledTimes(1);
    expect(
      clients.purposeTemplateProcessClient
        .unlinkEServiceTemplatesFromPurposeTemplate
    ).toHaveBeenCalledWith(
      { eserviceTemplateIds: [mockEServiceTemplateId] },
      expect.objectContaining({ params: { id: mockPurposeTemplateId } })
    );
    expect(
      clients.purposeTemplateProcessClient.unlinkEServicesFromPurposeTemplate
    ).toHaveBeenCalledTimes(0);
  });

  it.each([
    { description: "empty body", body: {} },
    {
      description: "missing resourceKind",
      body: { eserviceId: generateId() },
    },
    {
      description: "invalid resourceKind value",
      body: { resourceKind: "UNKNOWN", eserviceId: generateId() },
    },
    {
      description: "ESERVICE without eserviceId",
      body: { resourceKind: "ESERVICE" },
    },
    {
      description: "ESERVICE_TEMPLATE without eserviceTemplateId",
      body: { resourceKind: "ESERVICE_TEMPLATE" },
    },
    {
      description: "ESERVICE with mismatched eserviceTemplateId field",
      body: { resourceKind: "ESERVICE", eserviceTemplateId: generateId() },
    },
    {
      description: "ESERVICE_TEMPLATE with mismatched eserviceId field",
      body: { resourceKind: "ESERVICE_TEMPLATE", eserviceId: generateId() },
    },
    {
      description: "ESERVICE with non-uuid eserviceId",
      body: { resourceKind: "ESERVICE", eserviceId: "invalid" },
    },
    {
      description: "ESERVICE with extra unknown property",
      body: {
        resourceKind: "ESERVICE",
        eserviceId: generateId(),
        extra: "x",
      },
    },
  ])("Should return 400 for $description", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as unknown as bffApi.LinkableResourceRequest
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalid purposeTemplateId format", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      { resourceKind: "ESERVICE", eserviceId: mockEServiceId },
      "invalid-uuid"
    );
    expect(res.status).toBe(400);
  });

  it.each([
    { upstreamStatus: 404, description: "purpose template not found" },
    { upstreamStatus: 409, description: "association does not exist" },
  ])(
    "Should propagate $upstreamStatus when the process rejects with that status ($description)",
    async ({ upstreamStatus }) => {
      const upstreamError = new AxiosError(
        "upstream error",
        String(upstreamStatus),
        undefined,
        undefined,
        {
          status: upstreamStatus,
          data: {
            type: "about:blank",
            title: "upstream error",
            status: upstreamStatus,
            detail: "upstream error detail",
            correlationId: "test-correlation-id",
            errors: [{ code: "001-9999", detail: "upstream error detail" }],
          },
          statusText: "",
          config: {} as InternalAxiosRequestConfig,
          headers: {},
        }
      );
      clients.purposeTemplateProcessClient.unlinkEServicesFromPurposeTemplate =
        vi.fn().mockRejectedValue(upstreamError);

      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, {
        resourceKind: "ESERVICE",
        eserviceId: mockEServiceId,
      });
      expect(res.status).toBe(upstreamStatus);
    }
  );
});
