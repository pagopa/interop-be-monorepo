import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import { m2mGatewayApiV3, purposeApi } from "pagopa-interop-api-clients";
import {
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  missingMetadata,
  missingPurposeCurrentVersion,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("suspendPurposeVersion", () => {
  const mockApiPurposeVersion1 = getMockedApiPurposeVersion({
    state: purposeApi.PurposeVersionState.Enum.DRAFT,
  });
  const mockApiPurposeVersion2 = getMockedApiPurposeVersion({
    state: purposeApi.PurposeVersionState.Enum.REJECTED,
  });
  const mockApiPurpose = getMockWithMetadata(
    getMockedApiPurpose({
      versions: [mockApiPurposeVersion1, mockApiPurposeVersion2],
    })
  );
  const mockDelegationRef = { delegationId: generateId() };

  const suspendPurposeApiResponse: WithMetadata<purposeApi.PurposeVersion> = {
    data: mockApiPurposeVersion1,
    metadata: { version: 0 },
  };

  const pollingAttempts = 2;
  const mockSuspendPurposeVersion = vi
    .fn()
    .mockResolvedValue(suspendPurposeApiResponse);
  const mockGetPurpose = vi.fn(
    mockPollingResponse(mockApiPurpose, pollingAttempts)
  );

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
    suspendPurposeVersion: mockSuspendPurposeVersion,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockSuspendPurposeVersion.mockClear();
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    // The suspend will first get the purpose, then perform the polling
    mockGetPurpose.mockResolvedValueOnce(mockApiPurpose);

    const expectedM2MPurpose: m2mGatewayApiV3.Purpose = {
      consumerId: mockApiPurpose.data.consumerId,
      createdAt: mockApiPurpose.data.createdAt,
      description: mockApiPurpose.data.description,
      eserviceId: mockApiPurpose.data.eserviceId,
      id: mockApiPurpose.data.id,
      isFreeOfCharge: mockApiPurpose.data.isFreeOfCharge,
      isRiskAnalysisValid: mockApiPurpose.data.isRiskAnalysisValid,
      title: mockApiPurpose.data.title,
      delegationId: mockApiPurpose.data.delegationId,
      freeOfChargeReason: mockApiPurpose.data.freeOfChargeReason,
      updatedAt: mockApiPurpose.data.updatedAt,
      currentVersion: mockApiPurposeVersion1,
      rejectedVersion: mockApiPurposeVersion2,
      purposeTemplateId: mockApiPurpose.data.purposeTemplateId,
    };

    const purpose = await purposeService.suspendPurpose(
      unsafeBrandId(mockApiPurpose.data.id),
      mockDelegationRef,
      getMockM2MAdminAppContext()
    );

    expect(purpose).toEqual(expectedM2MPurpose);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.purposeProcessClient.suspendPurposeVersion,
      params: {
        purposeId: mockApiPurpose.data.id,
        versionId: mockApiPurposeVersion1.id,
      },
      body: mockDelegationRef,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: mockApiPurpose.data.id },
    });
    expect(
      mockInteropBeClients.purposeProcessClient.getPurpose
    ).toHaveBeenCalledTimes(pollingAttempts + 1);
  });

  it("Should throw missingPurposeCurrentVersion in case of missing active version to suspend", async () => {
    const invalidPurpose = getMockWithMetadata(
      getMockedApiPurpose({
        versions: [
          getMockedApiPurposeVersion({
            state: purposeApi.PurposeVersionState.Enum.REJECTED,
          }),
        ],
      })
    );
    // The suspend will first get the purpose, then perform the polling
    mockGetPurpose.mockResolvedValueOnce(invalidPurpose);

    await expect(
      purposeService.suspendPurpose(
        unsafeBrandId(mockApiPurpose.data.id),
        mockDelegationRef,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      missingPurposeCurrentVersion(invalidPurpose.data.id)
    );
  });

  it("Should throw missingMetadata in case the purpose returned by the suspend POST call has no metadata", async () => {
    mockSuspendPurposeVersion.mockResolvedValueOnce({
      data: mockApiPurposeVersion1,
      metadata: undefined,
    });

    await expect(
      purposeService.suspendPurpose(
        unsafeBrandId(mockApiPurpose.data.id),
        mockDelegationRef,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the purpose returned by the polling GET call has no metadata", async () => {
    // The suspend will first get the purpose, then perform the polling
    mockGetPurpose.mockResolvedValueOnce(mockApiPurpose).mockResolvedValue({
      data: mockApiPurpose.data,
      metadata: undefined,
    });

    await expect(
      purposeService.suspendPurpose(
        unsafeBrandId(mockApiPurpose.data.id),
        mockDelegationRef,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    // The suspend will first get the purpose, then perform the polling
    mockGetPurpose
      .mockResolvedValueOnce(mockApiPurpose)
      .mockImplementation(
        mockPollingResponse(mockApiPurpose, config.defaultPollingMaxRetries + 1)
      );

    await expect(
      purposeService.suspendPurpose(
        unsafeBrandId(mockApiPurpose.data.id),
        mockDelegationRef,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetPurpose).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries + 1
    );
  });
});
