import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiEService,
} from "../../mockUtils.js";

describe("updatePublishedEServiceName", () => {
  const mockEService = getMockedApiEservice();
  const mockEServiceProcessGetResponse = getMockWithMetadata(mockEService);

  const mockSeed: m2mGatewayApiV3.EServiceNameUpdateSeed = {
    name: "updated name",
  };

  const mockUpdateEServiceName = vi
    .fn()
    .mockResolvedValue(mockEServiceProcessGetResponse);
  const mockGetEService = vi.fn(
    mockPollingResponse(mockEServiceProcessGetResponse, 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    updateEServiceName: mockUpdateEServiceName,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockUpdateEServiceName.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const result = await eserviceService.updatePublishedEServiceName(
      unsafeBrandId(mockEService.id),
      mockSeed,
      getMockM2MAdminAppContext()
    );

    const expectedM2MEService: m2mGatewayApiV3.EService =
      testToM2mGatewayApiEService(mockEService);

    expect(result).toStrictEqual(expectedM2MEService);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.updateEServiceName,
      params: {
        eServiceId: mockEService.id,
      },
      body: mockSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: expectedM2MEService.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 2,
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: expectedM2MEService.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the eservice returned by the PATCH call has no metadata", async () => {
    mockUpdateEServiceName.mockResolvedValueOnce({
      ...mockEServiceProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updatePublishedEServiceName(
        unsafeBrandId(mockEService.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce({
      ...mockEServiceProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updatePublishedEServiceName(
        unsafeBrandId(mockEService.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockImplementation(
      mockPollingResponse(
        mockEServiceProcessGetResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.updatePublishedEServiceName(
        unsafeBrandId(mockEService.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEService).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
