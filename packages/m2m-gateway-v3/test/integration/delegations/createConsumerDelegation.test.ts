import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { delegationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
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

describe("createConsumerDelegation", () => {
  const mockDelegationSeed: m2mGatewayApiV3.DelegationSeed = {
    eserviceId: generateId(),
    delegateId: generateId(),
  };

  const mockDelegationProcessResponse = getMockWithMetadata(
    getMockedApiDelegation({
      kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
      eserviceId: mockDelegationSeed.eserviceId,
      delegateId: mockDelegationSeed.delegateId,
    })
  );

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

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockCreateConsumerDelegation.mockClear();
    mockGetDelegation.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mDelegationResponse: m2mGatewayApiV3.ConsumerDelegation = {
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

    const result = await delegationService.createConsumerDelegation(
      mockDelegationSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mDelegationResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.delegationProcessClient.consumer
          .createConsumerDelegation,
      body: mockDelegationSeed,
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
        kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
      },
    };

    mockInteropBeClients.delegationProcessClient.delegation.getDelegation =
      mockGetDelegation.mockResolvedValueOnce(mockResponse);

    await expect(
      delegationService.createConsumerDelegation(
        mockDelegationSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(unexpectedDelegationKind(mockResponse.data));
  });

  it("Should throw missingMetadata in case the delegation returned by the creation POST call has no metadata", async () => {
    mockCreateConsumerDelegation.mockResolvedValueOnce({
      ...mockDelegationProcessResponse,
      metadata: undefined,
    });

    await expect(
      delegationService.createConsumerDelegation(
        mockDelegationSeed,
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
      delegationService.createConsumerDelegation(
        mockDelegationSeed,
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
      delegationService.createConsumerDelegation(
        mockDelegationSeed,
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
