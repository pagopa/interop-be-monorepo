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
  getMockBffApiAttribute,
  getMockBffApiAttributeSeed,
} from "../../mockUtils.js";

describe("API POST /verifiedAttributes", () => {
  const mockAttributeSeed = getMockBffApiAttributeSeed();
  const mockAttribute = getMockBffApiAttribute("VERIFIED");

  const makeRequest = async (
    token: string,
    body: bffApi.AttributeSeed = mockAttributeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/verifiedAttributes`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    clients.attributeProcessClient.createVerifiedAttribute = vi
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
    const res = await makeRequest(token, {
      ...mockAttribute,
      kind: "invalid",
    } as bffApi.AttributeSeed);
    expect(res.status).toBe(400);
  });
});
