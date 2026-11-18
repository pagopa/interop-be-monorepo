/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /attributes/subunitPropagation/update", () => {
  const seed: bffApi.AttributeSubunitPropagationUpdateSeed = {
    attributeIds: [generateId()],
  };

  beforeEach(() => {
    clients.attributeProcessClient.updateAttributesSubunitPropagation = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (token: string, body: object = seed) =>
    request(api)
      .post(`${appBasePath}/attributes/subunitPropagation/update`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(res.status).toBe(204);
    expect(
      clients.attributeProcessClient.updateAttributesSubunitPropagation
    ).toHaveBeenCalledWith(seed, expect.anything());
  });

  it.each([
    { body: {} },
    { body: { attributeIds: ["not-a-uuid"] } },
    { body: { attributeIds: [generateId(), generateId()] } },
    { body: { ...seed, extraField: 1 } },
  ])("Should return 400 if passed an invalid body: %s", async ({ body }) => {
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), body);
    expect(res.status).toBe(400);
  });
});
