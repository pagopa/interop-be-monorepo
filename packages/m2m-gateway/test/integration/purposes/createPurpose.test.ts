import { describe, it, expect, vi, beforeEach } from "vitest";
import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import {
  getMockedApiDelegation,
  getMockedApiPurpose,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateMock } from "@anatine/zod-mock";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  missingMetadata,
  notAnActiveConsumerDelegation,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("createPurpose", () => {
  const mockPurposeProcessGetResponse = getMockWithMetadata(
    getMockedApiPurpose()
  );

  const mockPurposeSeed: m2mGatewayApi.PurposeSeed = {
    dailyCalls: mockPurposeProcessGetResponse.data.versions[0].dailyCalls,
    description: mockPurposeProcessGetResponse.data.description,
    eserviceId: mockPurposeProcessGetResponse.data.eserviceId,
    isFreeOfCharge: mockPurposeProcessGetResponse.data.isFreeOfCharge,
    freeOfChargeReason: mockPurposeProcessGetResponse.data.freeOfChargeReason,
    title: mockPurposeProcessGetResponse.data.title,
    riskAnalysisForm: generateMock(m2mGatewayApi.RiskAnalysisFormSeed),
    delegationId: undefined,
  };

  const mockCreatePurpose = vi
    .fn()
    .mockResolvedValue(mockPurposeProcessGetResponse);
  const mockGetPurpose = vi.fn();
  const mockGetDelegation = vi.fn();

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
    createPurpose: mockCreatePurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  mockInteropBeClients.delegationProcessClient = {
    delegation: { getDelegation: mockGetDelegation },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

  beforeEach(() => {
    mockCreatePurpose.mockClear();
    mockGetPurpose.mockClear();
    mockGetDelegation.mockClear();
  });

  const expectedM2MPurpose: m2mGatewayApi.Purpose = {
    consumerId: mockPurposeProcessGetResponse.data.consumerId,
    createdAt: mockPurposeProcessGetResponse.data.createdAt,
    description: mockPurposeProcessGetResponse.data.description,
    eserviceId: mockPurposeProcessGetResponse.data.eserviceId,
    id: mockPurposeProcessGetResponse.data.id,
    isFreeOfCharge: mockPurposeProcessGetResponse.data.isFreeOfCharge,
    isRiskAnalysisValid: mockPurposeProcessGetResponse.data.isRiskAnalysisValid,
    title: mockPurposeProcessGetResponse.data.title,
    currentVersion: mockPurposeProcessGetResponse.data.versions.at(0),
    delegationId: mockPurposeProcessGetResponse.data.delegationId,
    freeOfChargeReason: mockPurposeProcessGetResponse.data.freeOfChargeReason,
    rejectedVersion: undefined,
    suspendedByConsumer: undefined,
    suspendedByProducer: undefined,
    updatedAt: mockPurposeProcessGetResponse.data.updatedAt,
    waitingForApprovalVersion: undefined,
  };

  const mockAppContext = getMockM2MAdminAppContext();
  const mockConsumerDelegation: delegationApi.Delegation =
    getMockedApiDelegation({
      kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
      eserviceId: mockPurposeSeed.eserviceId,
      state: delegationApi.DelegationState.Values.ACTIVE,
      delegateId: mockAppContext.authData.organizationId,
    });

  it("Should succeed and perform service calls without delegationId", async () => {
    mockGetPurpose.mockImplementation(
      mockPollingResponse(mockPurposeProcessGetResponse, 2)
    );

    const result = await purposeService.createPurpose(
      mockPurposeSeed,
      mockAppContext
    );

    expect(result).toEqual(expectedM2MPurpose);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.purposeProcessClient.createPurpose,
      body: {
        dailyCalls: mockPurposeSeed.dailyCalls,
        description: mockPurposeSeed.description,
        eserviceId: mockPurposeSeed.eserviceId,
        riskAnalysisForm: mockPurposeSeed.riskAnalysisForm,
        isFreeOfCharge: mockPurposeSeed.isFreeOfCharge,
        freeOfChargeReason: mockPurposeSeed.freeOfChargeReason,
        title: mockPurposeSeed.title,
        consumerId: mockAppContext.authData.organizationId,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: expectedM2MPurpose.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 2,
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: expectedM2MPurpose.id },
    });
    expect(
      mockInteropBeClients.purposeProcessClient.getPurpose
    ).toHaveBeenCalledTimes(2);
    expect(
      mockInteropBeClients.delegationProcessClient.delegation.getDelegation
    ).toHaveBeenCalledTimes(0);
  });

  it("Should succeed and perform service calls with delegationId", async () => {
    mockGetPurpose.mockImplementation(
      mockPollingResponse(mockPurposeProcessGetResponse, 2)
    );

    mockGetDelegation.mockResolvedValue(
      getMockWithMetadata(mockConsumerDelegation)
    );

    const mockPurposeSeedWithDelegation: m2mGatewayApi.PurposeSeed = {
      ...mockPurposeSeed,
      delegationId: mockConsumerDelegation.id,
    };

    const result = await purposeService.createPurpose(
      mockPurposeSeedWithDelegation,
      mockAppContext
    );

    expect(result).toEqual(expectedM2MPurpose);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.purposeProcessClient.createPurpose,
      body: {
        dailyCalls: mockPurposeSeed.dailyCalls,
        description: mockPurposeSeed.description,
        eserviceId: mockPurposeSeed.eserviceId,
        riskAnalysisForm: mockPurposeSeed.riskAnalysisForm,
        isFreeOfCharge: mockPurposeSeed.isFreeOfCharge,
        freeOfChargeReason: mockPurposeSeed.freeOfChargeReason,
        title: mockPurposeSeed.title,
        consumerId: mockConsumerDelegation.delegatorId,
      },
    });

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: expectedM2MPurpose.id },
    });
    expect(
      mockInteropBeClients.purposeProcessClient.getPurpose
    ).toHaveBeenCalledTimes(2);
    expect(
      mockInteropBeClients.delegationProcessClient.delegation.getDelegation
    ).toHaveBeenCalledTimes(1);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.delegationProcessClient.delegation.getDelegation,
      params: { delegationId: mockConsumerDelegation.id },
    });
  });

  it.each([
    {
      ...mockConsumerDelegation,
      state: delegationApi.DelegationState.Values.REJECTED,
    },
    {
      ...mockConsumerDelegation,
      state: delegationApi.DelegationState.Values.REVOKED,
    },
    {
      ...mockConsumerDelegation,
      state: delegationApi.DelegationState.Values.WAITING_FOR_APPROVAL,
    },
    {
      ...mockConsumerDelegation,
      kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
    },
    {
      ...mockConsumerDelegation,
      eserviceId: generateId(),
    },
    {
      ...mockConsumerDelegation,
      delegateId: generateId(),
    },
  ] satisfies delegationApi.Delegation[])(
    `Should throw notAnActiveConsumerDelegation if the specified delegation
    is not an active consumer delegation for requester tenant and e-service`,
    async (mockDelegation) => {
      mockGetDelegation.mockResolvedValue(getMockWithMetadata(mockDelegation));

      const mockPurposeSeedWithDelegation: m2mGatewayApi.PurposeSeed = {
        ...mockPurposeSeed,
        delegationId: mockDelegation.id,
      };

      await expect(
        purposeService.createPurpose(
          mockPurposeSeedWithDelegation,
          mockAppContext
        )
      ).rejects.toThrowError(
        notAnActiveConsumerDelegation(
          mockAppContext.authData.organizationId,
          mockPurposeSeed.eserviceId,
          mockDelegation
        )
      );
    }
  );

  it("Should throw missingMetadata in case the purpose returned by the creation POST call has no metadata", async () => {
    mockCreatePurpose.mockResolvedValueOnce({
      ...mockPurposeProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      purposeService.createPurpose(mockPurposeSeed, getMockM2MAdminAppContext())
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the purpose returned by the polling GET call has no metadata", async () => {
    mockGetPurpose.mockResolvedValueOnce({
      ...mockPurposeProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      purposeService.createPurpose(mockPurposeSeed, getMockM2MAdminAppContext())
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetPurpose.mockImplementation(
      mockPollingResponse(
        mockPurposeProcessGetResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      purposeService.createPurpose(mockPurposeSeed, getMockM2MAdminAppContext())
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetPurpose).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
