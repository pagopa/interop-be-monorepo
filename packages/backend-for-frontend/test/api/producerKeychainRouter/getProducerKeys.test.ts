/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPublicKey } from "../../mockUtils.js";

describe("API GET /producerKeychains/{producerKeychainId}/keys test", () => {
  const mockPublicKeys: bffApi.PublicKeys = {
    keys: [getMockBffApiPublicKey(), getMockBffApiPublicKey()],
    pagination: { offset: 0, limit: 10, totalCount: 20 },
  };

  beforeEach(() => {
    services.producerKeychainService.getProducerKeys = vi
      .fn()
      .mockResolvedValue(mockPublicKeys);
  });

  const makeRequest = async (
    token: string,
    producerKeychainId: string = generateId()
  ) =>
    request(api)
      .get(`${appBasePath}/producerKeychains/${producerKeychainId}/keys`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit: 10 });

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPublicKeys);
  });

  it("Should return 400 if passed an invalid producer keychain id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
