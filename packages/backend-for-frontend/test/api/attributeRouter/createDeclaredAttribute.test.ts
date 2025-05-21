/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockApiAttribute,
  getMockApiAttributeSeed,
} from "../../mockUtils.js";

describe("API POST /declaredAttributes", () => {
  const mockAttributeSeed = getMockApiAttributeSeed();
  const mockAttribute: bffApi.Attribute = {
    ...getMockApiAttribute(),
    kind: "DECLARED",
  };

  const makeRequest = async (
    token: string,
    payload: object = mockAttributeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/declaredAttributes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(payload);

  beforeEach(() => {
    clients.attributeProcessClient.createDeclaredAttribute = vi
      .fn()
      .mockResolvedValue(mockAttribute);
  });

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockAttribute);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, { ...mockAttribute, kind: "invalid" });
    expect(res.status).toBe(400);
  });
});
