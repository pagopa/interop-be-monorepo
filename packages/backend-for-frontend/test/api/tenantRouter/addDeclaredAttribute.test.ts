/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi, delegationApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockedApiDelegation,
  mockTokenOrganizationId,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /tenants/attributes/declared test", () => {
  const attributeSeed: bffApi.DeclaredTenantAttributeSeed = {
    id: generateId(),
  };

  beforeEach(() => {
    clients.tenantProcessClient.tenantAttribute.addDeclaredAttribute = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.DeclaredTenantAttributeSeed = attributeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/tenants/attributes/declared`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
    expect(
      clients.tenantProcessClient.tenantAttribute.addDeclaredAttribute
    ).toHaveBeenCalledWith(
      attributeSeed,
      expect.objectContaining({
        params: { tenantId: mockTokenOrganizationId },
      })
    );
  });

  it("Should resolve the target tenant from the delegation", async () => {
    const delegation: delegationApi.Delegation = getMockedApiDelegation();
    const seed: bffApi.DeclaredTenantAttributeSeed = {
      id: generateId(),
      delegationId: delegation.id,
    };
    clients.delegationProcessClient.delegation.getDelegation = vi
      .fn()
      .mockResolvedValue(delegation);

    const token: string = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, seed);

    expect(res.status).toBe(204);
    expect(
      clients.delegationProcessClient.delegation.getDelegation
    ).toHaveBeenCalledWith(
      expect.objectContaining({ params: { delegationId: delegation.id } })
    );
    expect(
      clients.tenantProcessClient.tenantAttribute.addDeclaredAttribute
    ).toHaveBeenCalledWith(
      seed,
      expect.objectContaining({ params: { tenantId: delegation.delegatorId } })
    );
  });

  it.each([
    { body: {} },
    { body: { id: "invalid" } },
    { body: { delegationId: generateId() } },
    { body: { ...attributeSeed, delegationId: "invalid" } },
    { body: { ...attributeSeed, extraField: true } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as bffApi.DeclaredTenantAttributeSeed
    );
    expect(res.status).toBe(400);
  });
});
