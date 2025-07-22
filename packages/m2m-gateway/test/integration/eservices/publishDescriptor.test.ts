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

describe("publishDescriptor", () => {
  const mockApiDescriptor: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    state: "DRAFT",
  };

  const mockApiEservice = getMockWithMetadata(
    getMockedApiEservice({
      descriptors: [mockApiDescriptor],
    })
  );

  const mockM2MEserviceResponse = toM2MGatewayApiEService(mockApiEservice.data);

  const mockPublishDescriptor = vi.fn().mockResolvedValue(mockApiEservice);
  const mockGetEservice = vi.fn(mockPollingResponse(mockApiEservice, 2));

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEservice,
    publishDescriptor: mockPublishDescriptor,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockPublishDescriptor.mockClear();
    mockGetEservice.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await eserviceService.publishDescriptor(
      unsafeBrandId(mockApiEservice.data.id),
      unsafeBrandId(mockApiDescriptor.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(mockM2MEserviceResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.publishDescriptor,
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

  it("Should throw missingMetadata in case the eservice returned by the publish call has no metadata", async () => {
    mockPublishDescriptor.mockResolvedValueOnce({
      metadata: undefined,
    });

    await expect(
      eserviceService.publishDescriptor(
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
      eserviceService.publishDescriptor(
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
      eserviceService.publishDescriptor(
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
