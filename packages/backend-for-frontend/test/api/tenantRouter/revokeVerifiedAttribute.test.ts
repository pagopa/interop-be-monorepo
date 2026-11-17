/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import {
  AgreementId,
  AttributeId,
  DelegationId,
  TenantId,
  generateId,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API DELETE /tenants/{tenantId}/attributes/verified/{attributeId} test", () => {
  const defaultAgreementId: AgreementId = generateId();
  const defaultDelegationId: DelegationId = generateId();

  beforeEach(() => {
    clients.tenantProcessClient.tenantAttribute.revokeVerifiedAttribute = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    tenantId: TenantId = generateId(),
    attributeId: AttributeId = generateId(),
    agreementId: AgreementId = defaultAgreementId,
    delegationId?: DelegationId
  ) =>
    request(api)
      .delete(
        `${appBasePath}/tenants/${tenantId}/attributes/verified/${attributeId}`
      )
      .query({ agreementId, delegationId })
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const tenantId: TenantId = generateId();
    const attributeId: AttributeId = generateId();
    const res = await makeRequest(token, tenantId, attributeId);
    expect(res.status).toBe(204);
    expect(
      clients.tenantProcessClient.tenantAttribute.revokeVerifiedAttribute
    ).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        params: { tenantId, attributeId },
        queries: { agreementId: defaultAgreementId, delegationId: undefined },
      })
    );
  });

  it("forwards an explicit delegationId in the query", async () => {
    const res = await makeRequest(
      generateToken(authRole.ADMIN_ROLE),
      undefined,
      undefined,
      defaultAgreementId,
      defaultDelegationId
    );
    expect(res.status).toBe(204);
    expect(
      clients.tenantProcessClient.tenantAttribute.revokeVerifiedAttribute
    ).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        queries: {
          agreementId: defaultAgreementId,
          delegationId: defaultDelegationId,
        },
      })
    );
  });

  const invalidRequests: Array<{
    tenantId?: TenantId;
    attributeId?: AttributeId;
    agreementId?: AgreementId;
    delegationId?: DelegationId;
  }> = [
    { tenantId: "invalid" as TenantId },
    { attributeId: "invalid" as AttributeId },
    { agreementId: "invalid" as AgreementId },
    { delegationId: "invalid" as DelegationId },
  ];

  it.each(invalidRequests)(
    "Should return 400 if passed invalid data: %s",
    async ({ tenantId, attributeId, agreementId, delegationId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        tenantId,
        attributeId,
        agreementId,
        delegationId
      );
      expect(res.status).toBe(400);
    }
  );

  it("Should return 400 if agreementId is passed only in the body", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await request(api)
      .delete(
        `${appBasePath}/tenants/${generateId()}/attributes/verified/${generateId()}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ agreementId: defaultAgreementId });

    expect(res.status).toBe(400);
  });
});
