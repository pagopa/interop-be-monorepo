/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  generateToken,
  getMockDelegation,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  DelegationId,
  TenantId,
  delegationKind,
  generateId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { delegationApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, delegationService } from "../vitest.api.setup.js";
import {
  delegationNotFound,
  incorrectState,
  operationRestrictedToDelegate,
} from "../../src/model/domain/errors.js";
import { delegationToApiDelegation } from "../../src/model/domain/apiConverter.js";

describe("API POST /producer/delegations/:delegationId/approve test", () => {
  const mockDelegation: Delegation = getMockDelegation({
    kind: delegationKind.delegatedProducer,
  });
  const serviceResponse = getMockWithMetadata(mockDelegation);
  const apiDelegation = delegationApi.Delegation.parse(
    delegationToApiDelegation(mockDelegation)
  );

  beforeEach(() => {
    delegationService.approveProducerDelegation = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    delegationId: DelegationId = mockDelegation.id
  ) =>
    request(api)
      .post(`/producer/delegations/${delegationId}/approve`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.M2M_ADMIN_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiDelegation);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    {
      error: operationRestrictedToDelegate(
        generateId<TenantId>(),
        mockDelegation.id
      ),
      expectedStatus: 403,
    },
    {
      error: delegationNotFound(mockDelegation.id),
      expectedStatus: 404,
    },
    {
      error: incorrectState(mockDelegation.id, "Active", "WaitingForApproval"),
      expectedStatus: 409,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      delegationService.approveProducerDelegation = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid delegation id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as DelegationId);
    expect(res.status).toBe(400);
  });
});
