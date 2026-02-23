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
import {
  eserviceDescriptorNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { toM2MGatewayApiEServiceDescriptor } from "../../../src/api/eserviceApiConverter.js";

describe("suspendDescriptor", () => {
  const mockApiDescriptor: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    state: "SUSPENDED",
  };

  const mockApiEservice = getMockWithMetadata(
    getMockedApiEservice({
      descriptors: [mockApiDescriptor],
    })
  );

  const mockM2MEserviceDescriptorResponse =
    toM2MGatewayApiEServiceDescriptor(mockApiDescriptor);

  const mockSuspendDescriptor = vi.fn().mockResolvedValue(mockApiEservice);
  const mockGetEservice = vi.fn(mockPollingResponse(mockApiEservice, 2));

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEservice,
    suspendDescriptor: mockSuspendDescriptor,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockSuspendDescriptor.mockClear();
    mockGetEservice.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await eserviceService.suspendDescriptor(
      unsafeBrandId(mockApiEservice.data.id),
      unsafeBrandId(mockApiDescriptor.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(mockM2MEserviceDescriptorResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.suspendDescriptor,
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

  it("Should throw eserviceDescriptorNotFound in case of descriptor missing in E-service returned by the process", async () => {
    const eserviceWithoutDescriptor: catalogApi.EService = {
      ...mockApiEservice.data,
      descriptors: [],
    };

    mockSuspendDescriptor.mockResolvedValue({
      data: eserviceWithoutDescriptor,
      metadata: { version: 0 },
    });
    await expect(
      eserviceService.suspendDescriptor(
        unsafeBrandId(mockApiEservice.data.id),
        unsafeBrandId(mockApiDescriptor.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorNotFound(mockApiEservice.data.id, mockApiDescriptor.id)
    );
  });

  it("Should throw missingMetadata in case the eservice returned by the suspend call has no metadata", async () => {
    mockSuspendDescriptor.mockResolvedValueOnce({
      metadata: undefined,
    });

    await expect(
      eserviceService.suspendDescriptor(
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
      eserviceService.suspendDescriptor(
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
      eserviceService.suspendDescriptor(
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
