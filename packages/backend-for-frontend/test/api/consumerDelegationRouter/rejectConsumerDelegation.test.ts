/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DelegationId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiRejectDelegationPayload } from "../../mockUtils.js";

describe("API POST /consumers/delegations/:delegationId/reject", () => {
  const mockRejectDelegationPayload = getMockBffApiRejectDelegationPayload();

  beforeEach(() => {
    clients.delegationProcessClient.consumer.rejectConsumerDelegation = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    delegationId: DelegationId = generateId(),
    body: bffApi.RejectDelegationPayload = mockRejectDelegationPayload
  ) =>
    request(api)
      .post(`${appBasePath}/consumers/delegations/${delegationId}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { delegationId: "invalid" as DelegationId },
    { body: {} },
    { body: { ...mockRejectDelegationPayload, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ delegationId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        delegationId,
        body as bffApi.RejectDelegationPayload
      );
      expect(res.status).toBe(400);
    }
  );
});
