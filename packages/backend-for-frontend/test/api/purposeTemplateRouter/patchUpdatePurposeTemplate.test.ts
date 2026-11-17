/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockedApiPurposeTemplate,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toBffPurposeTemplate } from "../../../src/api/purposeTemplateApiConverter.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockPurposeTemplateSeed } from "../../mockUtils.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API PATCH /purposeTemplates/:purposeTemplateId", () => {
  const purposeTemplate = getMockedApiPurposeTemplate();
  const seed: bffApi.PatchUpdatePurposeTemplateSeed = {
    purposeTitle: "updated purpose title",
    purposeDescription: "updated purpose description",
    targetDescription: "updated target description",
    targetTenantKind: "PRIVATE",
    purposeIsFreeOfCharge: false,
    purposeFreeOfChargeReason: null,
    purposeDailyCalls: 10,
    handlesPersonalData: true,
  };

  beforeEach(() => {
    clients.purposeTemplateProcessClient.patchUpdateDraftPurposeTemplateById =
      vi.fn().mockResolvedValue(purposeTemplate);
  });

  const makeRequest = (body: object = seed, id: string = purposeTemplate.id) =>
    request(api)
      .patch(`${appBasePath}/purposeTemplates/${id}`)
      .set("Authorization", `Bearer ${generateToken(authRole.ADMIN_ROLE)}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should forward one complete command and return the converted template", async () => {
    const res = await makeRequest();
    expect(res.status).toBe(200);
    expect(res.body).toEqual(toBffPurposeTemplate(purposeTemplate));
    expect(
      clients.purposeTemplateProcessClient.patchUpdateDraftPurposeTemplateById
    ).toHaveBeenCalledExactlyOnceWith(seed, {
      headers: expect.any(Object),
      params: { id: purposeTemplate.id },
    });
  });

  it.each(["DRAFT", "PUBLISHED", "SUSPENDED", "ARCHIVED"] as const)(
    "Should return the updated template in state %s",
    async (state) => {
      const updatedPurposeTemplate = { ...purposeTemplate, state };
      clients.purposeTemplateProcessClient.patchUpdateDraftPurposeTemplateById =
        vi.fn().mockResolvedValue(updatedPurposeTemplate);
      const res = await makeRequest({ purposeTitle: seed.purposeTitle });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(toBffPurposeTemplate(updatedPurposeTemplate));
    }
  );

  it("Should preserve the legacy PUT and its complete payload", async () => {
    const legacySeed = getMockPurposeTemplateSeed();
    clients.purposeTemplateProcessClient.updatePurposeTemplate = vi
      .fn()
      .mockResolvedValue(purposeTemplate);
    const res = await request(api)
      .put(`${appBasePath}/purposeTemplates/${purposeTemplate.id}`)
      .set("Authorization", `Bearer ${generateToken(authRole.ADMIN_ROLE)}`)
      .set("X-Correlation-Id", generateId())
      .send(legacySeed);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(toBffPurposeTemplate(purposeTemplate));
    expect(
      clients.purposeTemplateProcessClient.updatePurposeTemplate
    ).toHaveBeenCalledExactlyOnceWith(legacySeed, {
      headers: expect.any(Object),
      params: { id: purposeTemplate.id },
    });
    expect(
      clients.purposeTemplateProcessClient.patchUpdateDraftPurposeTemplateById
    ).not.toHaveBeenCalled();
  });

  it.each([
    { purposeTitle: "updated purpose title" },
    { purposeDescription: "updated purpose description" },
    { targetDescription: "updated target description" },
    { purposeTitle: "a".repeat(5), purposeDescription: "a".repeat(10) },
    { purposeTitle: "a".repeat(60), purposeDescription: "a".repeat(250) },
    { targetDescription: "a".repeat(10) },
    { targetDescription: "a".repeat(250) },
    { purposeFreeOfChargeReason: null },
    { purposeDailyCalls: null },
    { purposeTitle: purposeTemplate.purposeTitle },
  ])("Should forward partial seed %# without adding fields", async (body) => {
    const res = await makeRequest(body);
    expect(res.status).toBe(200);
    expect(
      clients.purposeTemplateProcessClient.patchUpdateDraftPurposeTemplateById
    ).toHaveBeenCalledExactlyOnceWith(body, {
      headers: expect.any(Object),
      params: { id: purposeTemplate.id },
    });
  });

  it.each([
    {},
    { purposeTitle: "a".repeat(4) },
    { purposeTitle: "a".repeat(61) },
    { purposeTitle: null },
    { purposeTitle: 123 },
    { purposeDescription: "a".repeat(9) },
    { purposeDescription: "a".repeat(251) },
    { purposeDescription: null },
    { targetDescription: "a".repeat(9) },
    { targetDescription: "a".repeat(251) },
    { targetDescription: null },
    { targetTenantKind: "invalid" },
    { purposeIsFreeOfCharge: "invalid" },
    { purposeFreeOfChargeReason: 123 },
    { purposeDailyCalls: 0 },
    { handlesPersonalData: "invalid" },
    { ...seed, extraField: true },
  ])(
    "Should reject invalid body %# before calling the process",
    async (body) => {
      const res = await makeRequest(body);
      expect(res.status).toBe(400);
      expect(
        clients.purposeTemplateProcessClient.patchUpdateDraftPurposeTemplateById
      ).not.toHaveBeenCalled();
    }
  );

  it("Should reject invalid ids before calling the process", async () => {
    const res = await makeRequest(seed, "invalid");
    expect(res.status).toBe(400);
    expect(
      clients.purposeTemplateProcessClient.patchUpdateDraftPurposeTemplateById
    ).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404, 409])(
    "Should propagate process status %s without retrying",
    async (status) => {
      const problem = {
        type: "about:blank",
        title: "Purpose Template update failed",
        status,
        detail: "Purpose Template update failed",
        errors: [{ code: "error", detail: "Purpose Template update failed" }],
      };
      clients.purposeTemplateProcessClient.patchUpdateDraftPurposeTemplateById =
        vi.fn().mockRejectedValue(
          new AxiosError(problem.title, undefined, undefined, undefined, {
            status,
            data: problem,
            statusText: problem.title,
            config: {} as InternalAxiosRequestConfig,
            headers: {},
          })
        );
      const res = await makeRequest();
      expect(res.status).toBe(status);
      expect(res.body.errors).toEqual(problem.errors);
      expect(
        clients.purposeTemplateProcessClient.patchUpdateDraftPurposeTemplateById
      ).toHaveBeenCalledTimes(1);
    }
  );

  it("Should reject an invalid process response", async () => {
    clients.purposeTemplateProcessClient.patchUpdateDraftPurposeTemplateById =
      vi.fn().mockResolvedValue({ ...purposeTemplate, id: "invalid" });
    const res = await makeRequest();
    expect(res.status).toBe(500);
  });
});
