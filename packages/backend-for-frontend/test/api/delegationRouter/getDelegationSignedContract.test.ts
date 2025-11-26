/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationContractId,
  DelegationId,
  generateId,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /delegations/:delegationId/signedContract/:contractId", () => {
  const mockBuffer = Buffer.from("content");

  beforeEach(() => {
    services.delegationService.getDelegationSignedContract = vi
      .fn()
      .mockResolvedValue(mockBuffer);
  });

  const makeRequest = async (
    token: string,
    delegationId: DelegationId = generateId(),
    contractId: DelegationContractId = generateId()
  ) =>
    request(api)
      .get(
        `${appBasePath}/delegations/${delegationId}/signedContract/${contractId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockBuffer);
  });

  it.each([{ delegationId: "invalid" as DelegationId }])(
    "Should return 400 if passed an invalid data: %s",
    async ({ delegationId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, delegationId);
      expect(res.status).toBe(400);
    }
  );
});
