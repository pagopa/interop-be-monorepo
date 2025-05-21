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
  missingActivePurposeVersionWithState,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
} from "../../mockUtils.js";

describe("activatePurposeVersion", () => {
  const mockApiPurposeVersion1 = getMockedApiPurposeVersion({ state: "DRAFT" });
  const mockApiPurposeVersion2 = getMockedApiPurposeVersion({
    state: "REJECTED",
  });
  const mockApiPurpose = getMockedApiPurpose({
    versions: [mockApiPurposeVersion1, mockApiPurposeVersion2],
  });

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
    mockGetPurpose.mockResolvedValueOnce(mockApiPurpose);

    await purposeService.activatePurpose(
      unsafeBrandId(mockApiPurpose.data.id),
      getMockM2MAdminAppContext()
    );

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

  it("Should throw missingActivePurposeVersionWithState in case of missing active version to activate", async () => {
    const invalidPurpose = getMockedApiPurpose({
      versions: [getMockedApiPurposeVersion({ state: "REJECTED" })],
    });
    mockGetPurpose.mockResolvedValueOnce(invalidPurpose);

    await expect(
      purposeService.activatePurpose(
        unsafeBrandId(mockApiPurpose.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      missingActivePurposeVersionWithState(
        invalidPurpose.data.id,
        purposeApi.PurposeVersionState.Values.DRAFT
      )
    );
  });

  it("Should throw resourcePollingTimeout in case of polling max attempts", async () => {
    // The activate will first get the purpose, then perform the polling
    mockGetPurpose
      .mockResolvedValueOnce(mockApiPurpose)
      .mockImplementation(
        mockPollingResponse(
          mockApiPurpose,
          config.defaultPollingMaxAttempts + 1
        )
      );

    await expect(
      purposeService.activatePurpose(
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
