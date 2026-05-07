/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateId,
  EServiceTemplateVersionId,
  generateId,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiEServiceTemplateAttributesSeed } from "../../mockUtils.js";

describe("API POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/attributes/update", () => {
  const mockEServiceTemplateAttributesSeed =
    getMockBffApiEServiceTemplateAttributesSeed();

  beforeEach(() => {
    clients.eserviceTemplateProcessClient.updateTemplateVersionAttributes = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = generateId(),
    eServiceTemplateVersionId: EServiceTemplateVersionId = generateId(),
    body: bffApi.EServiceTemplateAttributesSeed = mockEServiceTemplateAttributesSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/eservices/templates/${eServiceTemplateId}/versions/${eServiceTemplateVersionId}/attributes/update`
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
    { eServiceTemplateVersionId: "invalid" as EServiceTemplateVersionId },
    { body: {} },
    {
      body: {
        ...mockEServiceTemplateAttributesSeed,
        extraField: 1,
      },
    },
    {
      body: {
        ...mockEServiceTemplateAttributesSeed,
        certified: "invalid",
      },
    },
    {
      body: {
        ...mockEServiceTemplateAttributesSeed,
        certified: [
          [
            {
              id: generateId(),
              explicitAttributeVerification: false,
              dailyCallsPerConsumer: 500,
            },
          ],
        ],
      },
    },
    {
      body: {
        ...mockEServiceTemplateAttributesSeed,
        declared: "invalid",
      },
    },
    {
      body: {
        ...mockEServiceTemplateAttributesSeed,
        verified: "invalid",
      },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ eServiceTemplateId, eServiceTemplateVersionId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceTemplateId,
        eServiceTemplateVersionId,
        body as bffApi.EServiceTemplateAttributesSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
