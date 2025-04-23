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
import { appBasePath } from "../../../src/config/appBasePath.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";
import { AxiosError, AxiosResponse } from "axios";

describe("POST /consumerDelegations authorization test", () => {
  const mockDelegationSeed: m2mGatewayApi.DelegationSeed = {
    eserviceId: generateId(),
    delegateId: generateId(),
  };

  const mockDelegationProcessResponse: WithMaybeMetadata<delegationApi.Delegation> =
    {
      data: {
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
      },
      metadata: {
        version: 0,
      },
    };

  // TODO move into utils and add count param
  const mockPolling = (resp) => {
    let firstPollingCall = true;
    return async () => {
      if (firstPollingCall) {
        firstPollingCall = false;
        const notFound: AxiosError = new AxiosError(
          "Delegation not found",
          "404",
          undefined,
          undefined,
          { status: 404 } as AxiosResponse
        );
        return Promise.reject(notFound);
      }
      return Promise.resolve(resp);
    };
  };

  mockInteropBeClients.delegationProcessClient = {
    consumer: {
      createConsumerDelegation: vi
        .fn()
        .mockResolvedValue(mockDelegationProcessResponse),
    },
    delegation: {
      getDelegation: vi.fn(mockPolling(mockDelegationProcessResponse)),
    },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

  const makeRequest = async (token: string) =>
    request(api)
      .post(`${appBasePath}/consumerDelegations`)
      .set("Authorization", `Bearer ${token}`)
      .send(mockDelegationSeed);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      vi.spyOn(
        mockInteropBeClients.delegationProcessClient.delegation,
        "getDelegation"
      );

      const token = generateToken(role);
      const res = await makeRequest(token);

      const m2mDelegationResponse: m2mGatewayApi.ConsumerDelegation = {
        id: mockDelegationProcessResponse.data.id,
        delegatorId: mockDelegationProcessResponse.data.delegatorId,
        delegateId: mockDelegationProcessResponse.data.delegateId,
        eserviceId: mockDelegationProcessResponse.data.eserviceId,
        createdAt: mockDelegationProcessResponse.data.createdAt,
        updatedAt: mockDelegationProcessResponse.data.updatedAt,
        rejectionReason: mockDelegationProcessResponse.data.rejectionReason,
        revokedAt: mockDelegationProcessResponse.data.stamps.revocation?.when,
        submittedAt: mockDelegationProcessResponse.data.stamps.submission.when,
        activatedAt: mockDelegationProcessResponse.data.stamps.activation?.when,
        rejectedAt: mockDelegationProcessResponse.data.stamps.rejection?.when,
        state: mockDelegationProcessResponse.data.state,
      };

      expect(res.status).toBe(200);
      expect(res.body).toEqual(m2mDelegationResponse);
      // TODO add toHaveBeenCalledWith?
      expect(
        mockInteropBeClients.delegationProcessClient.delegation.getDelegation
      ).toHaveBeenCalledTimes(2);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  // TODO other tests also polling failure for too many attempts
});
