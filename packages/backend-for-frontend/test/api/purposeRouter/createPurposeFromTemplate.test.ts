/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId, PurposeTemplateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockPurposeFromTemplateSeed } from "../../mockUtils.js";

describe("API POST /purposeTemplates/{purposeTemplateId}/purposes", () => {
  const mockPurposeFromTemplateSeed = getMockPurposeFromTemplateSeed();
  const mockCreatedResource = {
    id: generateId(),
  };

  beforeEach(() => {
    clients.purposeProcessClient.createPurposeFromTemplate = vi
      .fn()
      .mockResolvedValue(mockCreatedResource);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = generateId(),
    body: bffApi.PurposeFromTemplateSeed = mockPurposeFromTemplateSeed
  ) =>
    request(api)
      .post(`${appBasePath}/purposeTemplates/${purposeTemplateId}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedResource);
  });

  it.each([
    { purposeTemplateId: "invalid" as PurposeTemplateId },
    { body: {} },
    { body: { title: "Mock purpose title" } },
    { body: { ...mockPurposeFromTemplateSeed, dailyCalls: "invalid" } },
    {
      body: {
        ...mockPurposeFromTemplateSeed,
        consumerId: "invalid",
      },
    },
    {
      body: {
        ...mockPurposeFromTemplateSeed,
        eserviceId: "invalid",
      },
    },
    {
      body: {
        ...mockPurposeFromTemplateSeed,
        extraField: 1,
      },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeTemplateId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        body as bffApi.PurposeFromTemplateSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
