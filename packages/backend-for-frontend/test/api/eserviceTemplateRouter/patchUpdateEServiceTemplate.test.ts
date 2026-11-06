/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockedApiEServiceTemplate,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API PATCH /eservices/templates/:eServiceTemplateId", () => {
  const template = getMockedApiEServiceTemplate();
  const seed: bffApi.PatchUpdateEServiceTemplateSeed = {
    name: "updated name",
    description: "updated description",
    intendedTarget: "updated intended target",
    technology: "SOAP",
    mode: "RECEIVE",
    isSignalHubEnabled: false,
    personalData: null,
    asyncExchange: null,
  };

  beforeEach(() => {
    clients.eserviceTemplateProcessClient.patchUpdateDraftEServiceTemplate = vi
      .fn()
      .mockResolvedValue(template);
  });

  const makeRequest = (
    body: object = seed,
    templateId: string = template.id,
    role:
      | typeof authRole.ADMIN_ROLE
      | typeof authRole.API_ROLE = authRole.ADMIN_ROLE
  ) =>
    request(api)
      .patch(`${appBasePath}/eservices/templates/${templateId}`)
      .set("Authorization", `Bearer ${generateToken(role)}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it.each([authRole.ADMIN_ROLE, authRole.API_ROLE])(
    "Should forward one complete command for role %s",
    async (role) => {
      const res = await makeRequest(seed, template.id, role);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: template.id });
      expect(
        clients.eserviceTemplateProcessClient.patchUpdateDraftEServiceTemplate
      ).toHaveBeenCalledExactlyOnceWith(seed, {
        headers: expect.any(Object),
        params: { templateId: template.id },
      });
    }
  );

  it.each([
    { name: "a".repeat(5) },
    { name: "a".repeat(45) },
    { description: "a".repeat(10) },
    { description: "a".repeat(400) },
    { intendedTarget: "a".repeat(10) },
    { intendedTarget: "a".repeat(250) },
    { personalData: null },
    { asyncExchange: null },
  ])("Should forward partial seed %# without adding fields", async (body) => {
    const res = await makeRequest(body);
    expect(res.status).toBe(200);
    expect(
      clients.eserviceTemplateProcessClient.patchUpdateDraftEServiceTemplate
    ).toHaveBeenCalledExactlyOnceWith(body, {
      headers: expect.any(Object),
      params: { templateId: template.id },
    });
  });

  it.each([
    {},
    { name: "a".repeat(4) },
    { name: "a".repeat(46) },
    { name: null },
    { name: 123 },
    { description: "a".repeat(9) },
    { description: "a".repeat(401) },
    { description: null },
    { intendedTarget: "a".repeat(9) },
    { intendedTarget: "a".repeat(251) },
    { intendedTarget: null },
    { technology: "invalid" },
    { mode: "invalid" },
    { isSignalHubEnabled: "invalid" },
    { personalData: "invalid" },
    { asyncExchange: "invalid" },
    { ...seed, extraField: true },
  ])(
    "Should reject invalid body %# before calling the process",
    async (body) => {
      const res = await makeRequest(body);
      expect(res.status).toBe(400);
      expect(
        clients.eserviceTemplateProcessClient.patchUpdateDraftEServiceTemplate
      ).not.toHaveBeenCalled();
    }
  );

  it("Should reject invalid ids before calling the process", async () => {
    const res = await makeRequest(seed, "invalid");
    expect(res.status).toBe(400);
    expect(
      clients.eserviceTemplateProcessClient.patchUpdateDraftEServiceTemplate
    ).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404, 409])(
    "Should propagate process status %s without retrying",
    async (status) => {
      const problem = {
        type: "about:blank",
        title: "Template update failed",
        status,
        detail: "Template update failed",
        errors: [{ code: "016-0001", detail: "Template update failed" }],
      };
      clients.eserviceTemplateProcessClient.patchUpdateDraftEServiceTemplate =
        vi.fn().mockRejectedValue(
          new AxiosError(
            "Template update failed",
            undefined,
            undefined,
            undefined,
            {
              status,
              data: problem,
              statusText: "Template update failed",
              config: {} as InternalAxiosRequestConfig,
              headers: {},
            }
          )
        );
      const res = await makeRequest();
      expect(res.status).toBe(status);
      expect(res.body.errors).toEqual(problem.errors);
      expect(
        clients.eserviceTemplateProcessClient.patchUpdateDraftEServiceTemplate
      ).toHaveBeenCalledTimes(1);
    }
  );

  it("Should reject an invalid process response", async () => {
    clients.eserviceTemplateProcessClient.patchUpdateDraftEServiceTemplate = vi
      .fn()
      .mockResolvedValue({ id: "invalid" });
    const res = await makeRequest();
    expect(res.status).toBe(500);
  });
});
