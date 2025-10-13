/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EServiceTemplateId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiCreatedResource } from "../../mockUtils.js";

describe("API POST /eservices/templates/:eServiceTemplateId/versions", () => {
  const mockEServiceId = generateId<EServiceTemplateId>();
  const mockApiCreatedResource = getMockBffApiCreatedResource(mockEServiceId);

  beforeEach(() => {
    services.eServiceTemplateService.createEServiceTemplateVersion = vi
      .fn()
      .mockResolvedValue(mockApiCreatedResource);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = generateId()
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/templates/${eServiceTemplateId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedResource);
  });

  it("Should return 400 if passed invalid eServiceTemplateId", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as EServiceTemplateId);
    expect(res.status).toBe(400);
  });
});
