/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { EServiceTemplateId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiMockEServiceTemplateNameUpdateSeed } from "../../mockUtils.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /eservices/templates/:eServiceTemplateId/name/update", () => {
  const mockEServiceTemplateId = generateId<EServiceTemplateId>();
  const mockEServiceTemplateNameUpdateSeed =
    getMockBffApiMockEServiceTemplateNameUpdateSeed();

  beforeEach(() => {
    clients.eserviceTemplateProcessClient.updateEServiceTemplateName = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = mockEServiceTemplateId,
    body: bffApi.EServiceTemplateNameUpdateSeed = mockEServiceTemplateNameUpdateSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/templates/${eServiceTemplateId}/name/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([5, 45])("Should accept a name of %s characters", async (length) => {
    const seed = { name: "a".repeat(length) };
    const res = await makeRequest(
      generateToken(authRole.ADMIN_ROLE),
      mockEServiceTemplateId,
      seed
    );
    expect(res.status).toBe(204);
    expect(
      clients.eserviceTemplateProcessClient.updateEServiceTemplateName
    ).toHaveBeenCalledExactlyOnceWith(seed, {
      headers: expect.any(Object),
      params: { templateId: mockEServiceTemplateId },
    });
  });

  it.each([4, 46, 60])(
    "Should reject a name of %s characters",
    async (length) => {
      const res = await makeRequest(
        generateToken(authRole.ADMIN_ROLE),
        mockEServiceTemplateId,
        { name: "a".repeat(length) }
      );
      expect(res.status).toBe(400);
      expect(
        clients.eserviceTemplateProcessClient.updateEServiceTemplateName
      ).not.toHaveBeenCalled();
    }
  );

  it.each([
    { eServiceTemplateId: "invalid" as EServiceTemplateId },
    { body: {} },
    {
      body: {
        ...mockEServiceTemplateNameUpdateSeed,
        extraField: 1,
      },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ eServiceTemplateId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceTemplateId,
        body as bffApi.EServiceTemplateNameUpdateSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
