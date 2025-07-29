/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DelegationId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API DELETE /consumers/delegations/:delegationId", () => {
  beforeEach(() => {
    clients.delegationProcessClient.consumer.revokeConsumerDelegation = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    delegationId: DelegationId = generateId()
  ) =>
    request(api)
      .delete(`${appBasePath}/consumers/delegations/${delegationId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([{ delegationId: "invalid" as DelegationId }])(
    "Should return 400 if passed invalid data: %s",
    async ({ delegationId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, delegationId);
      expect(res.status).toBe(400);
    }
  );
});
