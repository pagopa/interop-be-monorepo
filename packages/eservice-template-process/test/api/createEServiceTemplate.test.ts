/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockEServiceTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { api, eserviceTemplateService } from "../vitest.api.setup.js";
import { eserviceTemplateToApiEServiceTemplate } from "../../src/model/domain/apiConverter.js";
import { eserviceTemplateToApiEServiceTemplateSeed } from "../mockUtils.js";
import {
  eServiceTemplateDuplicate,
  inconsistentDailyCalls,
  originNotCompliant,
} from "../../src/model/domain/errors.js";

describe("API POST /templates", () => {
  const mockEserviceTemplate = getMockEServiceTemplate();

  const mockEserviceTemplateSeed =
    eserviceTemplateToApiEServiceTemplateSeed(mockEserviceTemplate);

  const makeRequest = async (
    token: string,
    body: eserviceTemplateApi.EServiceTemplateSeed = mockEserviceTemplateSeed
  ) =>
    request(api)
      .post("/templates")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    eserviceTemplateService.createEServiceTemplate = vi
      .fn()
      .mockResolvedValue(mockEserviceTemplate);
  });

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE, authRole.API_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.body).toEqual(
        eserviceTemplateToApiEServiceTemplate(mockEserviceTemplate)
      );
      expect(res.status).toBe(200);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed a not compliant body", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      {} as eserviceTemplateApi.EServiceTemplateSeed
    );
    expect(res.status).toBe(400);
  });

  it("Should return 403 for origin not compliant", async () => {
    const notCompliantOrigin = "https://not-allowed-origin.com";
    eserviceTemplateService.createEServiceTemplate = vi
      .fn()
      .mockRejectedValue(originNotCompliant(notCompliantOrigin));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `Requester origin ${notCompliantOrigin} is not allowed`
    );
    expect(res.status).toBe(403);
  });

  it("Should return 409 for eServiceTemplateDuplicate", async () => {
    const eserviceTemplateName = "duplicate";
    eserviceTemplateService.createEServiceTemplate = vi
      .fn()
      .mockRejectedValue(eServiceTemplateDuplicate(eserviceTemplateName));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      `An EService Template with name ${eserviceTemplateName} already exists`
    );
    expect(res.status).toBe(409);
  });

  it("Should return 400 for inconsistentDailyCalls", async () => {
    eserviceTemplateService.createEServiceTemplate = vi
      .fn()
      .mockRejectedValue(inconsistentDailyCalls());
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body.detail).toBe(
      "dailyCallsPerConsumer can't be greater than dailyCallsTotal"
    );
    expect(res.status).toBe(400);
  });
});
