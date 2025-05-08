import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  purposeService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { resourcePollingTimeout } from "../../../src/model/errors.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiPurpose,
  getMockedApiPurposeVersion,
} from "../../mockUtils.js";

describe("createPurposeVersion", () => {
  const mockApiPurposeVersion = getMockedApiPurposeVersion();
  const mockPurposeProcessGetResponse = getMockedApiPurpose({
    versions: [mockApiPurposeVersion],
  });

  const mockPurposeVersionSeed: m2mGatewayApi.PurposeVersionSeed = {
    dailyCalls: mockApiPurposeVersion.dailyCalls,
  };

  const mockCreatePurposeVersion = vi
    .fn()
    .mockResolvedValue({ data: mockApiPurposeVersion, metadata: undefined });
  const mockGetPurpose = vi.fn(
    mockPollingResponse(mockPurposeProcessGetResponse, 2)
  );

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
      unsafeBrandId(mockPurposeProcessGetResponse.data.id),
      mockPurposeVersionSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(mockApiPurposeVersion);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.purposeProcessClient.createPurposeVersion,
      body: mockPurposeVersionSeed,
      params: { purposeId: mockPurposeProcessGetResponse.data.id },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.purposeProcessClient.getPurpose,
      params: { id: mockPurposeProcessGetResponse.data.id },
    });
    expect(
      mockInteropBeClients.purposeProcessClient.getPurpose
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw resourcePollingTimeout in case of polling max attempts", async () => {
    mockGetPurpose.mockImplementation(
      mockPollingResponse(
        mockPurposeProcessGetResponse,
        config.defaultPollingMaxAttempts + 1
      )
    );

    await expect(
      purposeService.createPurposeVersion(
        unsafeBrandId(mockPurposeProcessGetResponse.data.id),
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
