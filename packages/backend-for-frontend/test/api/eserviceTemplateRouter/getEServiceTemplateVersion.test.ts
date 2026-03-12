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
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiEServiceTemplateVersionDetails } from "../../mockUtils.js";
import { eserviceTemplateVersionNotFound } from "../../../src/model/errors.js";

describe("API GET /eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId", () => {
  const mockEServiceTemplateVersion =
    getMockBffApiEServiceTemplateVersionDetails();

  beforeEach(() => {
    services.eServiceTemplateService.getEServiceTemplateVersion = vi
      .fn()
      .mockResolvedValue(mockEServiceTemplateVersion);
  });

  const makeRequest = async (
    token: string,
    eServiceTemplateId: EServiceTemplateId = generateId(),
    eServiceTemplateVersionId: EServiceTemplateVersionId = generateId()
  ) =>
    request(api)
      .get(
        `${appBasePath}/eservices/templates/${eServiceTemplateId}/versions/${eServiceTemplateVersionId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockEServiceTemplateVersion);
  });

  it("Should return 404 for eserviceTemplateVersionNotFound", async () => {
    services.eServiceTemplateService.getEServiceTemplateVersion = vi
      .fn()
      .mockRejectedValue(
        eserviceTemplateVersionNotFound(generateId(), generateId())
      );
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it.each([
    { eServiceTemplateId: "invalid" as EServiceTemplateId },
    { eServiceTemplateVersionId: "invalid" as EServiceTemplateVersionId },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ eServiceTemplateId, eServiceTemplateVersionId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceTemplateId,
        eServiceTemplateVersionId
      );
      expect(res.status).toBe(400);
    }
  );
});
