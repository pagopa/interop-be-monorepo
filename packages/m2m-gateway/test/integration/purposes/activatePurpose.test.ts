import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
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
  missingPurposeVersionWithState,
  missingMetadata,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("activatePurposeVersion", () => {
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

  const activatePurposeApiResponse: WithMetadata<purposeApi.PurposeVersion> = {
    data: mockApiPurposeVersion1,
    metadata: { version: 0 },
  };

  const pollingTentatives = 2;
  const mockActivatePurposeVersion = vi
    .fn()
    .mockResolvedValue(activatePurposeApiResponse);
  const mockGetPurpose = vi.fn(
    mockPollingResponse(mockApiPurpose, pollingTentatives)
  );

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
    activatePurposeVersion: mockActivatePurposeVersion,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockActivatePurposeVersion.mockClear();
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    // The activate will first get the purpose, then perform the polling
    mockGetPurpose.mockResolvedValueOnce(mockApiPurpose);

    const expectedM2MPurpose: m2mGatewayApi.Purpose = {
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
    };

    const purpose = await purposeService.activateDraftPurpose(
      unsafeBrandId(mockApiPurpose.data.id),
      getMockM2MAdminAppContext()
    );

    expect(purpose).toEqual(expectedM2MPurpose);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.purposeProcessClient.activatePurposeVersion,
      params: {
        purposeId: mockApiPurpose.data.id,
        versionId: mockApiPurposeVersion1.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: mockApiPurpose.data.id },
    });
    expect(
      mockInteropBeClients.purposeProcessClient.getPurpose
    ).toHaveBeenCalledTimes(pollingTentatives + 1);
  });

  it("Should throw missingPurposeVersionWithState in case of missing active version to activate", async () => {
    const invalidPurpose = getMockWithMetadata(
      getMockedApiPurpose({
        versions: [
          getMockedApiPurposeVersion({
            state: purposeApi.PurposeVersionState.Enum.REJECTED,
          }),
        ],
      })
    );
    // The activate will first get the purpose, then perform the polling
    mockGetPurpose.mockResolvedValueOnce(invalidPurpose);

    await expect(
      purposeService.activateDraftPurpose(
        unsafeBrandId(mockApiPurpose.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      missingPurposeVersionWithState(
        invalidPurpose.data.id,
        purposeApi.PurposeVersionState.Values.DRAFT
      )
    );
  });

  it("Should throw missingMetadata in case the purpose returned by the activation POST call has no metadata", async () => {
    mockActivatePurposeVersion.mockResolvedValueOnce({
      data: mockApiPurposeVersion1,
      metadata: undefined,
    });

    await expect(
      purposeService.activateDraftPurpose(
        unsafeBrandId(mockApiPurpose.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the purpose returned by the polling GET call has no metadata", async () => {
    // The activate will first get the purpose, then perform the polling
    mockGetPurpose.mockResolvedValueOnce(mockApiPurpose).mockResolvedValue({
      data: mockApiPurpose.data,
      metadata: undefined,
    });

    await expect(
      purposeService.activateDraftPurpose(
        unsafeBrandId(mockApiPurpose.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    // The activate will first get the purpose, then perform the polling
    mockGetPurpose
      .mockResolvedValueOnce(mockApiPurpose)
      .mockImplementation(
        mockPollingResponse(mockApiPurpose, config.defaultPollingMaxRetries + 1)
      );

    await expect(
      purposeService.activateDraftPurpose(
        unsafeBrandId(mockApiPurpose.data.id),
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
