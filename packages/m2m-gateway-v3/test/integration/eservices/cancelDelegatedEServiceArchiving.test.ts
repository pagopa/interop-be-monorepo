import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toM2MGatewayApiEServiceDescriptor } from "../../../src/api/eserviceApiConverter.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceService,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("cancelDelegatedEServiceArchiving", () => {
  const mockApiDescriptor: catalogApi.EServiceDescriptor = {
    ...getMockedApiEserviceDescriptor(),
    state: "DEPRECATED",
  };

  const mockApiEservice = getMockedApiEservice({
    descriptors: [mockApiDescriptor],
  });

  const mockEServiceProcessPostResponse = getMockWithMetadata(mockApiEservice);

  const mockCancelDelegatedDescriptorArchiving = vi
    .fn()
    .mockResolvedValue(mockEServiceProcessPostResponse);
  const mockGetEService = vi.fn(
    mockPollingResponse(mockEServiceProcessPostResponse, 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    cancelDelegatedEServiceArchiving: mockCancelDelegatedDescriptorArchiving,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockCancelDelegatedDescriptorArchiving.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    const result = await eserviceService.cancelDelegatedEServiceArchiving(
      unsafeBrandId(mockApiEservice.id),
      getMockM2MAdminAppContext()
    );

    const expectedM2MEServiceDescriptor: m2mGatewayApiV3.EServiceDescriptor =
      toM2MGatewayApiEServiceDescriptor(mockApiDescriptor);

    expect(result).toStrictEqual(expectedM2MEServiceDescriptor);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient
          .cancelDelegatedEServiceArchiving,
      params: {
        eServiceId: mockApiEservice.id,
        descriptorId: mockApiDescriptor.id,
      },
      body: undefined,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockApiEservice.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 2,
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockApiEservice.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the eservice returned by the POST call has no metadata", async () => {
    mockCancelDelegatedDescriptorArchiving.mockResolvedValueOnce({
      ...mockEServiceProcessPostResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.cancelDelegatedEServiceArchiving(
        unsafeBrandId(mockApiEservice.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce({
      data: mockApiEservice,
      metadata: undefined,
    });

    await expect(
      eserviceService.cancelDelegatedEServiceArchiving(
        unsafeBrandId(mockApiEservice.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockImplementation(
      mockPollingResponse(
        mockEServiceProcessPostResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.cancelDelegatedEServiceArchiving(
        unsafeBrandId(mockApiEservice.id),
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
