/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
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
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockPollingResponse,
} from "../../apiUtils.js";
import { config } from "../../../src/config/config.js";

describe("POST /consumerDelegations authorization test", () => {
  const mockDelegationSeed: m2mGatewayApi.DelegationSeed = {
    eserviceId: generateId(),
    delegateId: generateId(),
  };

  const mockDelegationProcessResponse: WithMaybeMetadata<delegationApi.Delegation> =
    {
      data: {
        kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
        id: generateId(),
        eserviceId: mockDelegationSeed.eserviceId,
        delegateId: mockDelegationSeed.delegateId,
        delegatorId: generateId(),
        createdAt: new Date().toISOString(),
        state: delegationApi.DelegationState.Values.WAITING_FOR_APPROVAL,
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

  const mockCreateConsumerDelegation = vi
    .fn()
    .mockResolvedValue(mockDelegationProcessResponse);

  const mockGetDelegation = vi.fn(
    mockPollingResponse(mockDelegationProcessResponse, 2)
  );

  mockInteropBeClients.delegationProcessClient = {
    consumer: {
      createConsumerDelegation: mockCreateConsumerDelegation,
    },
    delegation: {
      getDelegation: mockGetDelegation,
    },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

  const makeRequest = async (
    token: string,
    body: m2mGatewayApi.DelegationSeed
  ) =>
    request(api)
      .post(`${appBasePath}/consumerDelegations`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockCreateConsumerDelegation.mockClear();
    mockGetDelegation.mockClear();
  });

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform API clients calls for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockDelegationSeed);

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

      expectApiClientPostToHaveBeenCalledWith({
        mockPost:
          mockInteropBeClients.delegationProcessClient.consumer
            .createConsumerDelegation,
        body: mockDelegationSeed,
        token: token,
      });
      expectApiClientGetToHaveBeenCalledWith({
        mockGet:
          mockInteropBeClients.delegationProcessClient.delegation.getDelegation,
        params: { delegationId: mockDelegationProcessResponse.data.id },
        token: token,
      });
      expect(
        mockInteropBeClients.delegationProcessClient.delegation.getDelegation
      ).toHaveBeenCalledTimes(2);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockDelegationSeed);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid delegation seed", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, {} as m2mGatewayApi.DelegationSeed);

    expect(res.status).toBe(400);
  });

  it("Should return 500 in case the returned delegation has an unexpected kind", async () => {
    mockInteropBeClients.delegationProcessClient.delegation.getDelegation =
      mockGetDelegation.mockResolvedValueOnce({
        ...mockDelegationProcessResponse,
        data: {
          ...mockDelegationProcessResponse.data,
          kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
        },
      });
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockDelegationSeed);

    expect(res.status).toBe(500);
  });

  it("Should return 500 in case the delegation returned by the creation POST call has no metadata", async () => {
    mockCreateConsumerDelegation.mockResolvedValueOnce({
      ...mockDelegationProcessResponse,
      metadata: undefined,
    });
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockDelegationSeed);

    expect(res.status).toBe(500);
  });

  it("Should return 500 in case the delegation returned by the polling GET call has no metadata", async () => {
    mockGetDelegation.mockResolvedValueOnce({
      ...mockDelegationProcessResponse,
      metadata: undefined,
    });
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockDelegationSeed);

    expect(res.status).toBe(500);
  });

  it("Should return 500 in case of polling max attempts", async () => {
    mockGetDelegation.mockImplementation(
      mockPollingResponse(
        mockDelegationProcessResponse,
        config.defaultPollingMaxAttempts + 1
      )
    );
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockDelegationSeed);

    expect(res.status).toBe(500);
    expect(mockGetDelegation).toHaveBeenCalledTimes(
      config.defaultPollingMaxAttempts
    );
  });
});
