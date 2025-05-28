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
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiDescriptorAttributesSeed } from "../../mockUtils.js";

describe("API POST /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/attributes/update", () => {
  const mockEServiceTemplateId = generateId<EServiceTemplateId>();
  const mockEServiceTemplateVersionId = generateId<EServiceTemplateVersionId>();
  const mockDescriptorAttributesSeed = getMockBffApiDescriptorAttributesSeed();

  beforeEach(() => {
    clients.eserviceTemplateProcessClient.updateTemplateVersionAttributes = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: string = mockEServiceTemplateId,
    eServiceTemplateVersionId: string = mockEServiceTemplateVersionId,
    body: object = mockDescriptorAttributesSeed
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
    { eServiceTemplateId: "invalid" },
    { eServiceTemplateVersionId: "invalid" },
    { body: {} },
    {
      body: {
        ...mockDescriptorAttributesSeed,
        extraField: 1,
      },
    },
    {
      body: {
        ...mockDescriptorAttributesSeed,
        certified: "invalid",
      },
    },
    {
      body: {
        ...mockDescriptorAttributesSeed,
        declared: "invalid",
      },
    },
    {
      body: {
        ...mockDescriptorAttributesSeed,
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
        body
      );
      expect(res.status).toBe(400);
    }
  );
});
