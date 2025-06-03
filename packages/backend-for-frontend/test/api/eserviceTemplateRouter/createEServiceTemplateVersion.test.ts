/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EServiceTemplateId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiCreatedResource } from "../../mockUtils.js";

describe("API POST /eservices/templates/:eServiceTemplateId/versions", () => {
  const mockCreatedResource = getMockBffApiCreatedResource();

  beforeEach(() => {
    clients.eserviceTemplateProcessClient.createEServiceTemplateVersion = vi
      .fn()
      .mockResolvedValue(mockCreatedResource);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = generateId()
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/templates/${eServiceTemplateId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedResource);
  });

  it.each([{ eServiceTemplateId: "invalid" as EServiceTemplateId }])(
    "Should return 400 if passed invalid data: %s",
    async ({ eServiceTemplateId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, eServiceTemplateId);
      expect(res.status).toBe(400);
    }
  );
});
