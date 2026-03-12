/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockBffApiEServiceTemplate,
  getMockBffApiEServiceTemplateSeed,
} from "../../mockUtils.js";
import { toBffCreatedEServiceTemplateVersion } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("API POST /eservices/templates", () => {
  const mockEServiceTemplateSeed = getMockBffApiEServiceTemplateSeed();
  const mockEServiceTemplateApiEServiceTemplate =
    getMockBffApiEServiceTemplate();
  const mockEServiceTemplate = toBffCreatedEServiceTemplateVersion(
    mockEServiceTemplateApiEServiceTemplate
  );

  beforeEach(() => {
    clients.eserviceTemplateProcessClient.createEServiceTemplate = vi
      .fn()
      .mockResolvedValue(mockEServiceTemplateApiEServiceTemplate);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.EServiceTemplateSeed = mockEServiceTemplateSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/templates`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockEServiceTemplate);
  });

  it.each([
    { body: {} },
    {
      body: {
        ...mockEServiceTemplateSeed,
        name: "a".repeat(4),
      },
    },
    {
      body: {
        ...mockEServiceTemplateSeed,
        name: "a".repeat(61),
      },
    },
    {
      body: {
        ...mockEServiceTemplateSeed,
        intendedTarget: "a".repeat(9),
      },
    },
    {
      body: {
        ...mockEServiceTemplateSeed,
        intendedTarget: "a".repeat(251),
      },
    },
    {
      body: {
        ...mockEServiceTemplateSeed,
        description: "a".repeat(9),
      },
    },
    {
      body: {
        ...mockEServiceTemplateSeed,
        description: "a".repeat(251),
      },
    },
    {
      body: {
        ...mockEServiceTemplateSeed,
        technology: "invalid",
      },
    },
    {
      body: {
        ...mockEServiceTemplateSeed,
        mode: "invalid",
      },
    },
    {
      body: {
        ...mockEServiceTemplateSeed,
        versions: [{}],
      },
    },
    {
      body: {
        ...mockEServiceTemplateSeed,
        isSignalHubEnabled: "invalid",
      },
    },
    {
      body: {
        ...mockEServiceTemplateSeed,
        extraField: 1,
      },
    },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as bffApi.EServiceTemplateSeed);
    expect(res.status).toBe(400);
  });
});
