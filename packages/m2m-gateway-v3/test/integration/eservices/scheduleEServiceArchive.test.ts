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

describe("scheduleArchiveEService", () => {
  const mockEService = getMockedApiEservice();
  const mockEServiceProcessGetResponse = getMockWithMetadata(mockEService);

  const mockSeed: m2mGatewayApiV3.EServiceArchivingReasonSeed = {
    archivingReason: "test reason",
    gracePeriodDays: 60,
  };

  const mockScheduleEServiceArchive = vi
    .fn()
    .mockResolvedValue(mockEServiceProcessGetResponse);
  const mockGetEService = vi.fn(
    mockPollingResponse(mockEServiceProcessGetResponse, 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    scheduleEServiceArchiving: mockScheduleEServiceArchive,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockScheduleEServiceArchive.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const result = await eserviceService.scheduleArchiveEService(
      unsafeBrandId(mockEService.id),
      mockSeed,
      getMockM2MAdminAppContext()
    );

    const expectedM2MEService: m2mGatewayApiV3.EService =
      testToM2mGatewayApiEService(mockEService);

    expect(result).toStrictEqual(expectedM2MEService);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.scheduleEServiceArchiving,
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

  it.each(
    [30, 60, 90, 120].map((gracePeriodDays) => ({
      ...mockSeed,
      gracePeriodDays,
    }))
  )("Should succeed and perform service calls with body %s", async (body) => {
    const result = await eserviceService.scheduleArchiveEService(
      unsafeBrandId(mockEService.id),
      body as m2mGatewayApiV3.EServiceArchivingReasonSeed,
      getMockM2MAdminAppContext()
    );

    const expectedM2MEService: m2mGatewayApiV3.EService =
      testToM2mGatewayApiEService(mockEService);

    expect(result).toStrictEqual(expectedM2MEService);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.scheduleEServiceArchiving,
      params: {
        eServiceId: mockEService.id,
      },
      body,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: expectedM2MEService.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ...mockSeed, gracePeriodDays: undefined },
    { archivingReason: mockSeed.archivingReason },
  ])(
    "Should succeed and call process with default gracePeriodDays when body is %s",
    async (body) => {
      const result = await eserviceService.scheduleArchiveEService(
        unsafeBrandId(mockEService.id),
        body as m2mGatewayApiV3.EServiceArchivingReasonSeed,
        getMockM2MAdminAppContext()
      );

      const expectedM2MEService: m2mGatewayApiV3.EService =
        testToM2mGatewayApiEService(mockEService);

      expect(result).toStrictEqual(expectedM2MEService);
      expectApiClientPostToHaveBeenCalledWith({
        mockPost:
          mockInteropBeClients.catalogProcessClient.scheduleEServiceArchiving,
        params: {
          eServiceId: mockEService.id,
        },
        body: mockSeed,
      });
    }
  );

  it("Should throw missingMetadata in case the eservice returned by the POST call has no metadata", async () => {
    mockScheduleEServiceArchive.mockResolvedValueOnce({
      ...mockEServiceProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.scheduleArchiveEService(
        unsafeBrandId(mockEService.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce({
      ...mockEServiceProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.scheduleArchiveEService(
        unsafeBrandId(mockEService.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockImplementation(
      mockPollingResponse(
        mockEServiceProcessGetResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.scheduleArchiveEService(
        unsafeBrandId(mockEService.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
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
