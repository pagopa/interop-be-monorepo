import { describe, it, expect, vi, beforeEach } from "vitest";
import { delegationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
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

describe("acceptProducerDelegation", () => {
  const mockDelegationProcessResponse = getMockWithMetadata(
    getMockedApiDelegation({
      kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
      state: delegationApi.DelegationState.Values.ACTIVE,
    })
  );

  const mockApproveProducerDelegation = vi
    .fn()
    .mockResolvedValue(mockDelegationProcessResponse);

  const mockGetDelegation = vi.fn(
    mockPollingResponse(mockDelegationProcessResponse, 2)
  );

  mockInteropBeClients.delegationProcessClient = {
    producer: {
      approveProducerDelegation: mockApproveProducerDelegation,
    },
    delegation: {
      getDelegation: mockGetDelegation,
    },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockApproveProducerDelegation.mockClear();
    mockGetDelegation.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mDelegationResponse: m2mGatewayApiV3.ProducerDelegation = {
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

    const result = await delegationService.acceptProducerDelegation(
      mockDelegationProcessResponse.data.id,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mDelegationResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.delegationProcessClient.producer
          .approveProducerDelegation,
      params: {
        delegationId: mockDelegationProcessResponse.data.id,
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
      delegationService.acceptProducerDelegation(
        mockDelegationProcessResponse.data.id,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(unexpectedDelegationKind(mockResponse.data));
  });

  it("Should throw missingMetadata in case the delegation returned by the creation POST accept call has no metadata", async () => {
    mockApproveProducerDelegation.mockResolvedValueOnce({
      ...mockDelegationProcessResponse,
      metadata: undefined,
    });

    await expect(
      delegationService.acceptProducerDelegation(
        mockDelegationProcessResponse.data.id,
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
      delegationService.acceptProducerDelegation(
        mockDelegationProcessResponse.data.id,
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
      delegationService.acceptProducerDelegation(
        mockDelegationProcessResponse.data.id,
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
