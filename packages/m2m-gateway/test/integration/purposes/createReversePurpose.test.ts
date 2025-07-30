import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import {
  getMockedApiPurpose,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
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
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("createReversePurpose", () => {
  const mockPurposeProcessGetResponse = getMockWithMetadata(
    getMockedApiPurpose()
  );

  const mockEServicePurposeSeed: m2mGatewayApi.EServicePurposeSeed = {
    dailyCalls: mockPurposeProcessGetResponse.data.versions[0].dailyCalls,
    description: mockPurposeProcessGetResponse.data.description,
    eserviceId: mockPurposeProcessGetResponse.data.eserviceId,
    riskAnalysisId: generateId(),
    isFreeOfCharge: mockPurposeProcessGetResponse.data.isFreeOfCharge,
    freeOfChargeReason: mockPurposeProcessGetResponse.data.freeOfChargeReason,
    title: mockPurposeProcessGetResponse.data.title,
    delegationId: undefined,
  };

  const mockCreatePurposeFromEService = vi
    .fn()
    .mockResolvedValue(mockPurposeProcessGetResponse);
  const mockGetPurpose = vi.fn(
    mockPollingResponse(mockPurposeProcessGetResponse, 2)
  );
  const mockGetDelegation = vi.fn();

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
    createPurposeFromEService: mockCreatePurposeFromEService,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  mockInteropBeClients.delegationProcessClient = {
    delegation: { getDelegation: mockGetDelegation },
  } as unknown as PagoPAInteropBeClients["delegationProcessClient"];

  beforeEach(() => {
    mockCreatePurposeFromEService.mockClear();
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform service calls without delegationId", async () => {
    const expectedM2MPurpose: m2mGatewayApi.Purpose = {
      consumerId: mockPurposeProcessGetResponse.data.consumerId,
      createdAt: mockPurposeProcessGetResponse.data.createdAt,
      description: mockPurposeProcessGetResponse.data.description,
      eserviceId: mockPurposeProcessGetResponse.data.eserviceId,
      id: mockPurposeProcessGetResponse.data.id,
      isFreeOfCharge: mockPurposeProcessGetResponse.data.isFreeOfCharge,
      isRiskAnalysisValid:
        mockPurposeProcessGetResponse.data.isRiskAnalysisValid,
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

    const result = await purposeService.createReversePurpose(
      mockEServicePurposeSeed,
      mockAppContext
    );

    expect(result).toEqual(expectedM2MPurpose);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.purposeProcessClient.createPurposeFromEService,
      body: {
        dailyCalls: mockEServicePurposeSeed.dailyCalls,
        description: mockEServicePurposeSeed.description,
        eServiceId: mockEServicePurposeSeed.eserviceId,
        riskAnalysisId: mockEServicePurposeSeed.riskAnalysisId,
        isFreeOfCharge: mockEServicePurposeSeed.isFreeOfCharge,
        freeOfChargeReason: mockEServicePurposeSeed.freeOfChargeReason,
        title: mockEServicePurposeSeed.title,
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

  // TODO test delegation and test that purpose process is called with the right consumerId

  it("Should throw missingMetadata in case the purpose returned by the creation POST call has no metadata", async () => {
    mockCreatePurposeFromEService.mockResolvedValueOnce({
      ...mockPurposeProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      purposeService.createReversePurpose(
        mockEServicePurposeSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the purpose returned by the polling GET call has no metadata", async () => {
    mockGetPurpose.mockResolvedValueOnce({
      ...mockPurposeProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      purposeService.createReversePurpose(
        mockEServicePurposeSeed,
        getMockM2MAdminAppContext()
      )
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
      purposeService.createReversePurpose(
        mockEServicePurposeSeed,
        getMockM2MAdminAppContext()
      )
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
