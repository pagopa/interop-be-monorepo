import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientPostToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";

describe("cancelEServiceArchiving", () => {
  const mockApiEservice = getMockWithMetadata(getMockedApiEservice());
  const mockM2MEserviceResponse = toM2MGatewayApiEService(mockApiEservice.data);

  const mockCancelArchiving = vi.fn().mockResolvedValue(mockApiEservice);
  const mockGetEservice = vi.fn(mockPollingResponse(mockApiEservice, 2));

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEservice,
    cancelEServiceArchiving: mockCancelArchiving,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockCancelArchiving.mockClear();
    mockGetEservice.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await eserviceService.cancelEServiceArchiving(
      unsafeBrandId(mockApiEservice.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(mockM2MEserviceResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockCancelArchiving,
      params: {
        eServiceId: mockApiEservice.data.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockApiEservice.data.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the eservice returned by the cancel call has no metadata", async () => {
    mockCancelArchiving.mockResolvedValueOnce({
      metadata: undefined,
    });

    await expect(
      eserviceService.cancelEServiceArchiving(
        unsafeBrandId(mockApiEservice.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEservice.mockResolvedValueOnce({
      data: mockApiEservice.data,
      metadata: undefined,
    });

    await expect(
      eserviceService.cancelEServiceArchiving(
        unsafeBrandId(mockApiEservice.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEservice.mockImplementation(
      mockPollingResponse(mockApiEservice, config.defaultPollingMaxRetries + 1)
    );

    await expect(
      eserviceService.cancelEServiceArchiving(
        unsafeBrandId(mockApiEservice.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
  });
});
