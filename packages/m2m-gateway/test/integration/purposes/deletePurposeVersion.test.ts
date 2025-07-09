import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
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
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("deletePurposeVersion", () => {
  const mockApiPurposeVersion = getMockedApiPurposeVersion();
  const mockApiPurpose = getMockWithMetadata(
    getMockedApiPurpose({
      versions: [mockApiPurposeVersion],
    })
  );

  const mockDeletePurposeVersion = vi.fn().mockResolvedValue(mockApiPurpose);
  const mockGetPurpose = vi.fn(mockPollingResponse(mockApiPurpose, 2));

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
    deletePurposeVersion: mockDeletePurposeVersion,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockDeletePurposeVersion.mockClear();
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    await purposeService.deletePurposeVersion(
      unsafeBrandId(mockApiPurpose.data.id),
      unsafeBrandId(mockApiPurposeVersion.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.purposeProcessClient.deletePurposeVersion,
      params: {
        purposeId: mockApiPurpose.data.id,
        versionId: mockApiPurposeVersion.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: mockApiPurpose.data.id },
    });
    expect(
      mockInteropBeClients.purposeProcessClient.getPurpose
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the purpose returned by the DELETE call has no metadata", async () => {
    mockDeletePurposeVersion.mockResolvedValueOnce({
      metadata: undefined,
    });

    await expect(
      purposeService.deletePurposeVersion(
        unsafeBrandId(mockApiPurpose.data.id),
        unsafeBrandId(mockApiPurposeVersion.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the purpose returned by the polling GET call has no metadata", async () => {
    mockGetPurpose.mockResolvedValueOnce({
      data: mockApiPurpose.data,
      metadata: undefined,
    });

    await expect(
      purposeService.deletePurposeVersion(
        unsafeBrandId(mockApiPurpose.data.id),
        unsafeBrandId(mockApiPurposeVersion.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetPurpose.mockImplementation(
      mockPollingResponse(mockApiPurpose, config.defaultPollingMaxRetries + 1)
    );

    await expect(
      purposeService.deletePurposeVersion(
        unsafeBrandId(mockApiPurpose.data.id),
        unsafeBrandId(mockApiPurposeVersion.id),
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
