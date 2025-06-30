import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  PurposeId,
  unsafeBrandId,
} from "pagopa-interop-models";
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

describe("updatePurpose", () => {
  const mockPurposeProcessGetResponse = getMockWithMetadata(
    getMockedApiPurpose()
  );

  const mockPurposeUpdateContent: m2mGatewayApi.PurposeUpdateContent = {
    dailyCalls: mockPurposeProcessGetResponse.data.versions[0].dailyCalls,
    description: mockPurposeProcessGetResponse.data.description,
    isFreeOfCharge: mockPurposeProcessGetResponse.data.isFreeOfCharge,
    title: mockPurposeProcessGetResponse.data.title,
  };

  const mockUpdatePurpose = vi
    .fn()
    .mockResolvedValue(mockPurposeProcessGetResponse);
  const mockGetPurpose = vi.fn(
    mockPollingResponse(mockPurposeProcessGetResponse, 2)
  );

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
    updatePurpose: mockUpdatePurpose,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockUpdatePurpose.mockClear();
    mockGetPurpose.mockClear();
  });

  const purposeId: PurposeId = unsafeBrandId(
    mockPurposeProcessGetResponse.data.id
  );

  it("Should succeed and perform service calls", async () => {
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

    const result = await purposeService.updatePurpose(
      purposeId,
      mockPurposeUpdateContent,
      mockAppContext
    );

    expect(result).toEqual(expectedM2MPurpose);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.purposeProcessClient.updatePurpose,
      body: mockPurposeUpdateContent,
      params: { id: expectedM2MPurpose.id },
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
  });

  it("Should throw missingMetadata in case the purpose returned by the update POST call has no metadata", async () => {
    mockUpdatePurpose.mockResolvedValueOnce({
      ...mockPurposeProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      purposeService.updatePurpose(
        purposeId,
        mockPurposeUpdateContent,
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
      purposeService.updatePurpose(
        purposeId,
        mockPurposeUpdateContent,
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
      purposeService.updatePurpose(
        purposeId,
        mockPurposeUpdateContent,
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
