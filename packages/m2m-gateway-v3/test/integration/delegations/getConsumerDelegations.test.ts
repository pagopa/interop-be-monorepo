import { describe, it, expect, vi, beforeEach } from "vitest";
import { delegationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { getMockedApiDelegation } from "pagopa-interop-commons-test";
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
  const mockParams: m2mGatewayApiV3.GetConsumerDelegationsQueryParams = {
    states: ["WAITING_FOR_APPROVAL"],
    eserviceIds: [generateId()],
    delegateIds: [generateId()],
    delegatorIds: [generateId()],
    offset: 0,
    limit: 10,
  };

  const mockApiDelegation1 = getMockedApiDelegation({
    kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
  });

  const mockApiDelegation2 = getMockedApiDelegation({
    kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
  });

  const mockApiDelegations = [mockApiDelegation1, mockApiDelegation2];

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
    const m2mDelegationResponse1: m2mGatewayApiV3.ConsumerDelegation = {
      id: mockApiDelegation1.id,
      delegatorId: mockApiDelegation1.delegatorId,
      delegateId: mockApiDelegation1.delegateId,
      eserviceId: mockApiDelegation1.eserviceId,
      createdAt: mockApiDelegation1.createdAt,
      updatedAt: mockApiDelegation1.updatedAt,
      rejectionReason: mockApiDelegation1.rejectionReason,
      revokedAt: mockApiDelegation1.stamps.revocation?.when,
      submittedAt: mockApiDelegation1.stamps.submission.when,
      activatedAt: mockApiDelegation1.stamps.activation?.when,
      rejectedAt: mockApiDelegation1.stamps.rejection?.when,
      state: mockApiDelegation1.state,
    };

    const m2mDelegationResponse2: m2mGatewayApiV3.ConsumerDelegation = {
      id: mockApiDelegation2.id,
      delegatorId: mockApiDelegation2.delegatorId,
      delegateId: mockApiDelegation2.delegateId,
      eserviceId: mockApiDelegation2.eserviceId,
      createdAt: mockApiDelegation2.createdAt,
      updatedAt: mockApiDelegation2.updatedAt,
      rejectionReason: mockApiDelegation2.rejectionReason,
      revokedAt: mockApiDelegation2.stamps.revocation?.when,
      submittedAt: mockApiDelegation2.stamps.submission.when,
      activatedAt: mockApiDelegation2.stamps.activation?.when,
      rejectedAt: mockApiDelegation2.stamps.rejection?.when,
      state: mockApiDelegation2.state,
    };

    const m2mDelegationsResponse: m2mGatewayApiV3.ConsumerDelegations = {
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

    expect(result).toStrictEqual(m2mDelegationsResponse);
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
      ...mockApiDelegation1,
      kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
    };
    const mockResponse = {
      ...mockDelegationProcessResponse,
      data: {
        ...mockDelegationProcessResponse,
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
