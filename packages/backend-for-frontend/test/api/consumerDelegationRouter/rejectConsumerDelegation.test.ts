/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DelegationId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { delegationApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockRejectDelegationPayload } from "../../mockUtils.js";

describe("API POST /consumers/delegations/:delegationId/reject", () => {
  const mockDelegationId = generateId<DelegationId>();
  const mockRejectDelegationPayload = getMockRejectDelegationPayload();

  beforeEach(() => {
    clients.delegationProcessClient.consumer = {} as ReturnType<
      typeof delegationApi.createConsumerApiClient
    >;
    clients.delegationProcessClient.consumer.rejectConsumerDelegation = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    delegationId: string = mockDelegationId
  ) =>
    request(api)
      .post(`${appBasePath}/consumers/delegations/${delegationId}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockRejectDelegationPayload);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([{ delegationId: "invalid" }])(
    "Should return 400 if passed invalid data: %s",
    async ({ delegationId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, delegationId);
      expect(res.status).toBe(400);
    }
  );
});
