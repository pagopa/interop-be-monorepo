import { describe, it, expect, vi, beforeEach } from "vitest";
import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import {
  getMockedApiDelegation,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  delegationService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";
import { unexpectedDelegationKind } from "../../../src/model/errors.js";

describe("getConsumerDelegations", () => {
  const mockParams: m2mGatewayApi.GetConsumerDelegationsQueryParams = {
    states: ["WAITING_FOR_APPROVAL"],
    eserviceIds: [generateId()],
    delegateIds: [generateId()],
    delegatorIds: [generateId()],
    offset: 0,
    limit: 10,
  };

  const mockApiDelegation1 = getMockWithMetadata(
    getMockedApiDelegation({
      kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
    })
  );
  const mockApiDelegation2 = getMockWithMetadata(
    getMockedApiDelegation({
      kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
    })
  );

  const mockApiDelegations = [mockApiDelegation1.data, mockApiDelegation2.data];

  const mockDelegationProcessResponse: WithMaybeMetadata<delegationApi.Delegations> =
    {
      data: {
        results: mockApiDelegations,
        totalCount: mockApiDelegations.length,
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
    const m2mDelegationResponse1: m2mGatewayApi.ConsumerDelegation = {
      id: mockApiDelegation1.data.id,
      delegatorId: mockApiDelegation1.data.delegatorId,
      delegateId: mockApiDelegation1.data.delegateId,
      eserviceId: mockApiDelegation1.data.eserviceId,
      createdAt: mockApiDelegation1.data.createdAt,
      updatedAt: mockApiDelegation1.data.updatedAt,
      rejectionReason: mockApiDelegation1.data.rejectionReason,
      revokedAt: mockApiDelegation1.data.stamps.revocation?.when,
      submittedAt: mockApiDelegation1.data.stamps.submission.when,
      activatedAt: mockApiDelegation1.data.stamps.activation?.when,
      rejectedAt: mockApiDelegation1.data.stamps.rejection?.when,
      state: mockApiDelegation1.data.state,
    };

    const m2mDelegationResponse2: m2mGatewayApi.ConsumerDelegation = {
      id: mockApiDelegation2.data.id,
      delegatorId: mockApiDelegation2.data.delegatorId,
      delegateId: mockApiDelegation2.data.delegateId,
      eserviceId: mockApiDelegation2.data.eserviceId,
      createdAt: mockApiDelegation2.data.createdAt,
      updatedAt: mockApiDelegation2.data.updatedAt,
      rejectionReason: mockApiDelegation2.data.rejectionReason,
      revokedAt: mockApiDelegation2.data.stamps.revocation?.when,
      submittedAt: mockApiDelegation2.data.stamps.submission.when,
      activatedAt: mockApiDelegation2.data.stamps.activation?.when,
      rejectedAt: mockApiDelegation2.data.stamps.rejection?.when,
      state: mockApiDelegation2.data.state,
    };

    const m2mDelegationsResponse: m2mGatewayApi.ConsumerDelegations = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockDelegationProcessResponse.data.totalCount,
      },
      results: [m2mDelegationResponse1, m2mDelegationResponse2],
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
