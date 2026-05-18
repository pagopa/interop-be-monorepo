import { describe, it, expect, vi, beforeEach } from "vitest";
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
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
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toM2MGatewayApiEServiceDescriptor } from "../../../src/api/eserviceApiConverter.js";

describe("scheduleArchiveEServiceDescriptor", () => {
  const mockApiDescriptor: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    state: "DEPRECATED",
  };

  const mockApiEservice = getMockWithMetadata(
    getMockedApiEservice({
      descriptors: [mockApiDescriptor],
    })
  );

  const mockEServiceProcessPostResponse = getMockWithMetadata(mockApiEservice);

  const mockScheduleEServiceDescriptorArchive = vi
    .fn()
    .mockResolvedValue(mockApiEservice);
  const mockGetEService = vi.fn(mockPollingResponse(mockApiEservice, 2));

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    scheduleEServiceDescriptorArchiving: mockScheduleEServiceDescriptorArchive,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockScheduleEServiceDescriptorArchive.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const result = await eserviceService.scheduleArchiveEserviceDescriptor(
      unsafeBrandId(mockApiEservice.data.id),
      unsafeBrandId(mockApiDescriptor.id),
      getMockM2MAdminAppContext()
    );

    const expectedM2MEServiceDescriptor: m2mGatewayApiV3.EServiceDescriptor =
      toM2MGatewayApiEServiceDescriptor(mockApiDescriptor);

    expect(result).toStrictEqual(expectedM2MEServiceDescriptor);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient
          .scheduleEServiceDescriptorArchiving,
      params: {
        eServiceId: mockApiEservice.data.id,
        descriptorId: mockApiDescriptor.id,
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockApiEservice.data.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 2,
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockApiEservice.data.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the eservice returned by the POST call has no metadata", async () => {
    mockScheduleEServiceDescriptorArchive.mockResolvedValueOnce({
      ...mockEServiceProcessPostResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.scheduleArchiveEserviceDescriptor(
        unsafeBrandId(mockApiEservice.data.id),
        unsafeBrandId(mockApiDescriptor.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce({
      data: mockApiEservice.data,
      metadata: undefined,
    });

    await expect(
      eserviceService.scheduleArchiveEserviceDescriptor(
        unsafeBrandId(mockApiEservice.data.id),
        unsafeBrandId(mockApiDescriptor.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockImplementation(
      mockPollingResponse(mockApiEservice, config.defaultPollingMaxRetries + 1)
    );

    await expect(
      eserviceService.scheduleArchiveEserviceDescriptor(
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
    expect(mockGetEService).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
