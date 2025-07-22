import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toM2MGatewayApiEService } from "../../../src/api/eserviceApiConverter.js";

describe("unsuspendDescriptor", () => {
  const mockApiDescriptor: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    state: "SUSPENDED",
  };

  const mockApiEservice = getMockWithMetadata(
    getMockedApiEservice({
      descriptors: [mockApiDescriptor],
    })
  );

  const mockM2MEserviceResponse = toM2MGatewayApiEService(mockApiEservice.data);

  const mockActivateDescriptor = vi.fn().mockResolvedValue(mockApiEservice);
  const mockGetEservice = vi.fn(mockPollingResponse(mockApiEservice, 2));

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEservice,
    activateDescriptor: mockActivateDescriptor,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockActivateDescriptor.mockClear();
    mockGetEservice.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await eserviceService.unsuspendDescriptor(
      unsafeBrandId(mockApiEservice.data.id),
      unsafeBrandId(mockApiDescriptor.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(mockM2MEserviceResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.activateDescriptor,
      params: {
        eServiceId: mockApiEservice.data.id,
        descriptorId: mockApiDescriptor.id,
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

  it("Should throw missingMetadata in case the eservice returned by the Ununsuspend call has no metadata", async () => {
    mockActivateDescriptor.mockResolvedValueOnce({
      metadata: undefined,
    });

    await expect(
      eserviceService.unsuspendDescriptor(
        unsafeBrandId(mockApiEservice.data.id),
        unsafeBrandId(mockApiDescriptor.id),
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
      eserviceService.unsuspendDescriptor(
        unsafeBrandId(mockApiEservice.data.id),
        unsafeBrandId(mockApiDescriptor.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEservice.mockImplementation(
      mockPollingResponse(mockApiEservice, config.defaultPollingMaxRetries + 1)
    );

    await expect(
      eserviceService.unsuspendDescriptor(
        unsafeBrandId(mockApiEservice.data.id),
        unsafeBrandId(mockApiDescriptor.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEservice).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
