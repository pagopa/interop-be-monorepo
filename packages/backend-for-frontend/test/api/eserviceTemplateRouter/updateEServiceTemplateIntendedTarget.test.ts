/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EServiceTemplateId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiMockEServiceTemplateIntendedTargetUpdateSeed } from "../../mockUtils.js";

describe("API POST /eservices/templates/:eServiceTemplateId/intendedTarget/update", () => {
  const mockEServiceTemplateIntendedTargetUpdateSeed =
    getMockBffApiMockEServiceTemplateIntendedTargetUpdateSeed();

  beforeEach(() => {
    clients.eserviceTemplateProcessClient.updateEServiceTemplateIntendedTarget =
      vi.fn().mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = generateId(),
    body: bffApi.EServiceTemplateIntendedTargetUpdateSeed = mockEServiceTemplateIntendedTargetUpdateSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/templates/${eServiceTemplateId}/intendedTarget/update`
      )
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
        ...mockEServiceTemplateIntendedTargetUpdateSeed,
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
        body as bffApi.EServiceTemplateIntendedTargetUpdateSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
