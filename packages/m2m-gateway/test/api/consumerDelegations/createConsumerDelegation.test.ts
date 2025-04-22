/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { api } from "../../vitest.api.setup.js";
import { mockInteropBeClients } from "../../vitest.api.setup.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";

describe("POST /consumerDelegations authorization test", () => {
  const mockDelegationSeed: m2mGatewayApi.DelegationSeed = {
    eserviceId: generateId(),
    delegateId: generateId(),
  };

  const mockDelegationProcessResponse: delegationApi.Delegation = {
    kind: "DELEGATED_CONSUMER",
    id: generateId(),
    eserviceId: mockDelegationSeed.eserviceId,
    delegateId: mockDelegationSeed.delegateId,
    delegatorId: generateId(),
    createdAt: new Date().toISOString(),
    state: "ACTIVE",
    stamps: {
      submission: {
        who: generateId(),
        when: new Date().toISOString(),
      },
    },
  };

  mockInteropBeClients.delegationProcessClient = {
    consumer: {
      createConsumerDelegation: vi
        .fn()
        .mockResolvedValue(mockDelegationProcessResponse),
    } as unknown as PagoPAInteropBeClients["delegationProcessClient"]["consumer"],
  } as PagoPAInteropBeClients["delegationProcessClient"];

  const makeRequest = async (token: string) =>
    request(api)
      .post("/consumerDelegations")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockDelegationSeed);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockDelegationSeed);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  // TODO other tests
});
