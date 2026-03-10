import { describe, it, expect, vi, beforeEach } from "vitest";
import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import {
  getMockedApiDelegation,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  delegationService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  missingMetadata,
  unexpectedDelegationKind,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("rejectProducerDelegation", () => {
  const mockDelegationProcessResponse = getMockWithMetadata(
    getMockedApiDelegation({
      kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
      state: delegationApi.DelegationState.Values.REJECTED,
    })
  );

  const mockRejectProducerDelegation = vi
    .fn()
    .mockResolvedValue(mockDelegationProcessResponse);

  const mockGetDelegation = vi.fn(
    mockPollingResponse(mockDelegationProcessResponse, 2)
  );

  mockInteropBeClients.delegationProcessClient = {
    producer: {
      rejectProducerDelegation: mockRejectProducerDelegation,
    },
    delegation: {
      getDelegation: mockGetDelegation,
    },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockRejectProducerDelegation.mockClear();
    mockGetDelegation.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mDelegationResponse: m2mGatewayApi.ProducerDelegation = {
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

    const result = await delegationService.rejectProducerDelegation(
      mockDelegationProcessResponse.data.id,
      { rejectionReason: "test reason" },
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mDelegationResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.delegationProcessClient.producer
          .rejectProducerDelegation,
      params: {
        delegationId: mockDelegationProcessResponse.data.id,
      },
      body: {
        rejectionReason: "test reason",
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.delegationProcessClient.delegation.getDelegation,
      params: { delegationId: mockDelegationProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.delegationProcessClient.delegation.getDelegation
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw unexpectedDelegationKind in case the returned delegation has an unexpected kind", async () => {
    const mockResponse = {
      ...mockDelegationProcessResponse,
      data: {
        ...mockDelegationProcessResponse.data,
        kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
      },
    };

    mockInteropBeClients.delegationProcessClient.delegation.getDelegation =
      mockGetDelegation.mockResolvedValueOnce(mockResponse);

    await expect(
      delegationService.rejectProducerDelegation(
        mockDelegationProcessResponse.data.id,
        { rejectionReason: "test reason" },
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(unexpectedDelegationKind(mockResponse.data));
  });

  it("Should throw missingMetadata in case the delegation returned by the creation POST accept call has no metadata", async () => {
    mockRejectProducerDelegation.mockResolvedValueOnce({
      ...mockDelegationProcessResponse,
      metadata: undefined,
    });

    await expect(
      delegationService.rejectProducerDelegation(
        mockDelegationProcessResponse.data.id,
        { rejectionReason: "test reason" },
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the delegation returned by the polling GET call has no metadata", async () => {
    mockGetDelegation.mockResolvedValueOnce({
      ...mockDelegationProcessResponse,
      metadata: undefined,
    });

    await expect(
      delegationService.rejectProducerDelegation(
        mockDelegationProcessResponse.data.id,
        { rejectionReason: "test reason" },
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetDelegation.mockImplementation(
      mockPollingResponse(
        mockDelegationProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      delegationService.rejectProducerDelegation(
        mockDelegationProcessResponse.data.id,
        { rejectionReason: "test reason" },
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetDelegation).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
