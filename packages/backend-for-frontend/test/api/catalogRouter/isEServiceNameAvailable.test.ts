/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockApiCatalogEService } from "../../mockUtils.js";

describe("API GET /eservices/names/availability", () => {
  const mockEService1 = getMockApiCatalogEService();
  const mockEService2 = getMockApiCatalogEService();
  const mockEService3 = getMockApiCatalogEService();
  const mockEServices = {
    results: [mockEService1, mockEService2, mockEService3],
    pagination: {
      offset: 0,
      limit: 10,
      totalCount: 3,
    },
  };

  const makeRequest = async (token: string, name: unknown = "unusual name") =>
    request(api)
      .get(`${appBasePath}/eservices/names/availability`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ name })
      .send();

  beforeEach(() => {
    clients.catalogProcessClient.getEServices = vi
      .fn()
      .mockResolvedValue(mockEServices);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(true);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await request(api)
      .get(`${appBasePath}/eservices/names/availability`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();
    expect(res.status).toBe(400);
  });
});
