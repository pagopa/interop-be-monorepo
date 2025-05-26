import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import { getMockM2MAdminAppContext } from "pagopa-interop-commons-test/src/testUtils.js";
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
  purposeVersionNotFound,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import {
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
} from "../../mockUtils.js";

describe("createPurposeVersion", () => {
  const mockApiPurposeVersion = getMockedApiPurposeVersion();
  const mockApiPurpose = getMockedApiPurpose({
    versions: [mockApiPurposeVersion],
  });

  const mockPurposeVersionSeed: m2mGatewayApi.PurposeVersionSeed = {
    dailyCalls: mockApiPurposeVersion.dailyCalls,
  };

  const mockCreatePurposeVersion = vi.fn().mockResolvedValue({
    data: {
      purpose: mockApiPurpose.data,
      createdVersionId: mockApiPurposeVersion.id,
    },
    metadata: { version: 0 },
  });
  const mockGetPurpose = vi.fn(mockPollingResponse(mockApiPurpose, 2));

  mockInteropBeClients.purposeProcessClient = {
    getPurpose: mockGetPurpose,
    createPurposeVersion: mockCreatePurposeVersion,
  } as unknown as PagoPAInteropBeClients["purposeProcessClient"];

  beforeEach(() => {
    mockCreatePurposeVersion.mockClear();
    mockGetPurpose.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await purposeService.createPurposeVersion(
      unsafeBrandId(mockApiPurpose.data.id),
      mockPurposeVersionSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(mockApiPurposeVersion);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.purposeProcessClient.createPurposeVersion,
      body: mockPurposeVersionSeed,
      params: { purposeId: mockApiPurpose.data.id },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: mockApiPurpose.data.id },
    });
    expect(
      mockInteropBeClients.purposeProcessClient.getPurpose
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw purposeVersionNotFound in case of version missing in purpose returned by the process", async () => {
    const invalidPurpose = getMockedApiPurpose({ versions: [] });
    mockCreatePurposeVersion.mockResolvedValue({
      data: {
        purpose: invalidPurpose.data,
        createdVersionId: mockApiPurposeVersion.id,
      },
      metadata: { version: 0 },
    });

    await expect(
      purposeService.createPurposeVersion(
        unsafeBrandId(mockApiPurpose.data.id),
        mockPurposeVersionSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      purposeVersionNotFound(
        unsafeBrandId(mockApiPurpose.data.id),
        mockApiPurposeVersion.id
      )
    );
  });

  it("Should throw missingMetadata in case the purpose returned by the creation POST call has no metadata", async () => {
    mockCreatePurposeVersion.mockResolvedValueOnce({
      data: {
        purpose: mockApiPurpose.data,
        createdVersionId: mockApiPurposeVersion.id,
      },
      metadata: undefined,
    });

    await expect(
      purposeService.createPurposeVersion(
        unsafeBrandId(mockApiPurpose.data.id),
        mockPurposeVersionSeed,
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
      purposeService.createPurposeVersion(
        unsafeBrandId(mockApiPurpose.data.id),
        mockPurposeVersionSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw resourcePollingTimeout in case of polling max attempts", async () => {
    mockGetPurpose.mockImplementation(
      mockPollingResponse(mockApiPurpose, config.defaultPollingMaxAttempts + 1)
    );

    await expect(
      purposeService.createPurposeVersion(
        unsafeBrandId(mockApiPurpose.data.id),
        mockPurposeVersionSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      resourcePollingTimeout(config.defaultPollingMaxAttempts)
    );
    expect(mockGetPurpose).toHaveBeenCalledTimes(
      config.defaultPollingMaxAttempts
    );
  });
});
