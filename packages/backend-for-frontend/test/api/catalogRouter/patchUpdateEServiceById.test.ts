/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockCatalogApiEService } from "../../mockUtils.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API PATCH /eservices/:eServiceId", () => {
  const eservice = getMockCatalogApiEService();
  const seed: bffApi.PatchUpdateEServiceSeed = {
    name: "updated name",
    description: "updated description",
    technology: "SOAP",
    mode: "RECEIVE",
    isSignalHubEnabled: false,
    isConsumerDelegable: true,
    isClientAccessDelegable: true,
    personalData: null,
    asyncExchange: null,
  };

  beforeEach(() => {
    clients.catalogProcessClient.patchUpdateDraftEServiceById = vi
      .fn()
      .mockResolvedValue(eservice);
  });

  const makeRequest = (
    body: object = seed,
    eServiceId: string = eservice.id,
    role:
      | typeof authRole.ADMIN_ROLE
      | typeof authRole.API_ROLE = authRole.ADMIN_ROLE
  ) =>
    request(api)
      .patch(`${appBasePath}/eservices/${eServiceId}`)
      .set("Authorization", `Bearer ${generateToken(role)}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it.each([authRole.ADMIN_ROLE, authRole.API_ROLE])(
    "Should forward one complete command for role %s",
    async (role) => {
      const res = await makeRequest(seed, eservice.id, role);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: eservice.id });
      expect(
        clients.catalogProcessClient.patchUpdateDraftEServiceById
      ).toHaveBeenCalledExactlyOnceWith(seed, {
        headers: expect.any(Object),
        params: { eServiceId: eservice.id },
      });
    }
  );

  it.each([
    { name: "updated name" },
    { description: "updated description" },
    { name: "a".repeat(5), description: "a".repeat(10) },
    { name: "a".repeat(60), description: "a".repeat(400) },
    { personalData: null },
    { asyncExchange: null },
  ])("Should forward partial seed %# without adding fields", async (body) => {
    const res = await makeRequest(body);
    expect(res.status).toBe(200);
    expect(
      clients.catalogProcessClient.patchUpdateDraftEServiceById
    ).toHaveBeenCalledExactlyOnceWith(body, {
      headers: expect.any(Object),
      params: { eServiceId: eservice.id },
    });
  });

  it.each([
    {},
    { name: "a".repeat(4) },
    { name: "a".repeat(61) },
    { name: null },
    { name: 123 },
    { description: "a".repeat(9) },
    { description: "a".repeat(401) },
    { description: null },
    { technology: "invalid" },
    { mode: "invalid" },
    { isSignalHubEnabled: "invalid" },
    { isConsumerDelegable: "invalid" },
    { isClientAccessDelegable: "invalid" },
    { personalData: "invalid" },
    { asyncExchange: "invalid" },
    { ...seed, extraField: true },
  ])(
    "Should reject invalid body %# before calling the process",
    async (body) => {
      const res = await makeRequest(body);
      expect(res.status).toBe(400);
      expect(
        clients.catalogProcessClient.patchUpdateDraftEServiceById
      ).not.toHaveBeenCalled();
    }
  );

  it("Should reject invalid ids before calling the process", async () => {
    const res = await makeRequest(seed, "invalid");
    expect(res.status).toBe(400);
    expect(
      clients.catalogProcessClient.patchUpdateDraftEServiceById
    ).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404, 409])(
    "Should propagate process status %s without retrying",
    async (status) => {
      const problem = {
        type: "about:blank",
        title: "Catalog update failed",
        status,
        detail: "Catalog update failed",
        errors: [{ code: "004-0001", detail: "Catalog update failed" }],
      };
      clients.catalogProcessClient.patchUpdateDraftEServiceById = vi
        .fn()
        .mockRejectedValue(
          new AxiosError(
            "Catalog update failed",
            undefined,
            undefined,
            undefined,
            {
              status,
              data: problem,
              statusText: "Catalog update failed",
              config: {} as InternalAxiosRequestConfig,
              headers: {},
            }
          )
        );
      const res = await makeRequest();
      expect(res.status).toBe(status);
      expect(res.body.errors).toEqual(problem.errors);
      expect(
        clients.catalogProcessClient.patchUpdateDraftEServiceById
      ).toHaveBeenCalledTimes(1);
    }
  );

  it("Should reject an invalid process response", async () => {
    clients.catalogProcessClient.patchUpdateDraftEServiceById = vi
      .fn()
      .mockResolvedValue({ id: "invalid" });
    const res = await makeRequest();
    expect(res.status).toBe(500);
  });
});
