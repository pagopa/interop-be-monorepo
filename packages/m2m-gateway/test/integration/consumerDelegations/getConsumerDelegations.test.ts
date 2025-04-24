/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  delegationService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiDelegation,
} from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";
import { toM2MGatewayApiConsumerDelegation } from "../../../src/api/delegationApiConverter.js";
import { unexpectedDelegationKind } from "../../../src/model/errors.js";

describe("getConsumerDelegations", () => {
  const mockParams: m2mGatewayApi.GetConsumerDelegationsQueryParams = {
    states: ["WAITING_FOR_APPROVAL"],
    eserviceIds: [],
    delegateIds: [],
    delegatorIds: [],
    offset: 0,
    limit: 10,
  };

  const mockApiDelegation1 = getMockedApiDelegation({
    kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
  });
  const mockApiDelegation2 = getMockedApiDelegation({
    kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
  });

  const mockApiDeleggations = [
    mockApiDelegation1.data,
    mockApiDelegation2.data,
  ];

  const mockDelegationProcessResponse: WithMaybeMetadata<delegationApi.Delegations> =
    {
      data: {
        results: mockApiDeleggations,
        totalCount: mockApiDeleggations.length,
      },
      metadata: undefined,
    };

  const mockGetDelegations = vi
    .fn()
    .mockResolvedValue(mockDelegationProcessResponse);

  mockInteropBeClients.delegationProcessClient = {
    delegation: {
      getDelegations: mockGetDelegations,
    },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetDelegations.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mDelegationsResponse: m2mGatewayApi.ConsumerDelegations = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockDelegationProcessResponse.data.totalCount,
      },
      results: [
        toM2MGatewayApiConsumerDelegation(
          mockApiDelegation1.data as delegationApi.Delegation & {
            kind: typeof delegationApi.DelegationKind.Values.DELEGATED_CONSUMER;
          }
        ),
        toM2MGatewayApiConsumerDelegation(
          mockApiDelegation2.data as delegationApi.Delegation & {
            kind: typeof delegationApi.DelegationKind.Values.DELEGATED_CONSUMER;
          }
        ),
      ],
    };

    const result = await delegationService.getConsumerDelegations(
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mDelegationsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.delegationProcessClient.delegation.getDelegations,
      queries: {
        kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
        delegationStates: mockParams.states,
        delegatorIds: mockParams.delegatorIds,
        delegateIds: mockParams.delegateIds,
        eserviceIds: mockParams.eserviceIds,
        offset: mockParams.offset,
        limit: mockParams.limit,
      },
    });
  });

  it("Should throw unexpectedDelegationKind in case the returned delegation has an unexpected kind", async () => {
    const mockBadDelegation = {
      ...mockApiDelegation1.data,
      kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
    };
    const mockResponse = {
      ...mockDelegationProcessResponse,
      data: {
        ...mockDelegationProcessResponse.data,
        results: [
          ...mockDelegationProcessResponse.data.results,
          mockBadDelegation,
        ],
      },
    };

    mockInteropBeClients.delegationProcessClient.delegation.getDelegations =
      mockGetDelegations.mockResolvedValueOnce(mockResponse);

    await expect(
      delegationService.getConsumerDelegations(
        mockParams,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(unexpectedDelegationKind(mockBadDelegation));
  });
});
