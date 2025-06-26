/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /eservices/names/availability", () => {
  const defaultQuery = {
    name: "name",
  };

  beforeEach(() => {
    services.catalogService.isEServiceNameAvailable = vi
      .fn()
      .mockResolvedValue(true);
  });

  const makeRequest = async (
    token: string,
    query: typeof defaultQuery = defaultQuery
  ) =>
    request(api)
      .get(`${appBasePath}/eservices/names/availability`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query)
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(true);
  });

  it.each([{ query: {} }])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ query }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, query as typeof defaultQuery);
      expect(res.status).toBe(400);
    }
  );
});
