/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EServiceTemplateId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiEServiceTemplateUpdateSeed } from "../../mockUtils.js";

describe("API POST /eservices/templates/:eServiceTemplateId", () => {
  const mockEServiceTemplateUpdateSeed =
    getMockBffApiEServiceTemplateUpdateSeed();

  beforeEach(() => {
    clients.eserviceTemplateProcessClient.updateDraftEServiceTemplate = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = generateId(),
    body: bffApi.UpdateEServiceTemplateSeed = mockEServiceTemplateUpdateSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/templates/${eServiceTemplateId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { eServiceTemplateId: "invalid" as EServiceTemplateId },
    { body: {} },
    {
      body: {
        ...mockEServiceTemplateUpdateSeed,
        extraField: 1,
      },
    },
    {
      body: {
        ...mockEServiceTemplateUpdateSeed,
        name: "a".repeat(4),
      },
    },
    {
      body: {
        ...mockEServiceTemplateUpdateSeed,
        name: "a".repeat(61),
      },
    },
    {
      body: {
        ...mockEServiceTemplateUpdateSeed,
        description: "a".repeat(9),
      },
    },
    {
      body: {
        ...mockEServiceTemplateUpdateSeed,
        description: "a".repeat(251),
      },
    },
    {
      body: {
        ...mockEServiceTemplateUpdateSeed,
        technology: "invalid",
      },
    },
    {
      body: {
        ...mockEServiceTemplateUpdateSeed,
        mode: "invalid",
      },
    },
    {
      body: {
        ...mockEServiceTemplateUpdateSeed,
        isSignalHubEnabled: "invalid",
      },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ eServiceTemplateId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceTemplateId,
        body as bffApi.UpdateEServiceTemplateSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
