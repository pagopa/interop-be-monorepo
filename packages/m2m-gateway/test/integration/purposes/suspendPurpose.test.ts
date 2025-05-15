import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId, WithMetadata } from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
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
  missingActivePurposeVersion,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
} from "../../mockUtils.js";

describe("suspendPurposeVersion", () => {
  const mockApiPurposeVersion1 = getMockedApiPurposeVersion({ state: "DRAFT" });
  const mockApiPurposeVersion2 = getMockedApiPurposeVersion({
    state: "REJECTED",
  });
  const mockApiPurpose = getMockedApiPurpose({
    versions: [mockApiPurposeVersion1, mockApiPurposeVersion2],
  });

  const suspendPurposeApiResponse: WithMetadata<purposeApi.PurposeVersion> = {
    data: mockApiPurposeVersion1,
    metadata: { version: 0 },
  };

  const pollingTentatives = 2;
  const mocksuspendPurposeVersion = vi
    .fn()
    .mockResolvedValue(suspendPurposeApiResponse);
  const mockGetPurpose = vi.fn(
    mockPollingResponse(mockApiPurpose, pollingTentatives)
  );

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
    suspendPurposeVersion: mocksuspendPurposeVersion,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mocksuspendPurposeVersion.mockClear();
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    mockGetPurpose.mockResolvedValueOnce(mockApiPurpose);

    await purposeService.suspendPurpose(
      unsafeBrandId(mockApiPurpose.data.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.purposeProcessClient.suspendPurposeVersion,
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

  it("Should throw missingActivePurposeVersion in case of missing active version to suspend", async () => {
    const invalidPurpose = getMockedApiPurpose({
      versions: [getMockedApiPurposeVersion({ state: "REJECTED" })],
    });
    mockGetPurpose.mockResolvedValueOnce(invalidPurpose);

    await expect(
      purposeService.suspendPurpose(
        unsafeBrandId(mockApiPurpose.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingActivePurposeVersion(invalidPurpose.data.id));
  });

  it("Should throw resourcePollingTimeout in case of polling max attempts", async () => {
    // The suspend will first get the purpose, then perform the polling
    mockGetPurpose
      .mockResolvedValueOnce(mockApiPurpose)
      .mockImplementation(
        mockPollingResponse(
          mockApiPurpose,
          config.defaultPollingMaxAttempts + 1
        )
      );

    await expect(
      purposeService.suspendPurpose(
        unsafeBrandId(mockApiPurpose.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      resourcePollingTimeout(config.defaultPollingMaxAttempts)
    );
    expect(mockGetPurpose).toHaveBeenCalledTimes(
      config.defaultPollingMaxAttempts + 1
    );
  });
});
