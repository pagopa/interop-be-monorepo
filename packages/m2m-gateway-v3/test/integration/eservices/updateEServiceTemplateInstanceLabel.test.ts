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
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import {
  getMockM2MAdminAppContext,
  testToM2mGatewayApiEService,
} from "../../mockUtils.js";

describe("updateEServiceTemplateInstanceLabel", () => {
  const mockedApiEservice = getMockedApiEservice();

  const mockSeed: m2mGatewayApiV3.EServiceInstanceLabelUpdateSeed = {
    instanceLabel: "new-label",
  };

  const mockEserviceProcessResponse = getMockWithMetadata(mockedApiEservice);

  const mockUpdateLabel = vi
    .fn()
    .mockResolvedValue(mockEserviceProcessResponse);
  const mockGetEservice = vi.fn(
    mockPollingResponse(mockEserviceProcessResponse, 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    updateEServiceInstanceLabelAfterPublication: mockUpdateLabel,
    getEServiceById: mockGetEservice,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockUpdateLabel.mockClear();
    mockGetEservice.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mEserviceResponse: m2mGatewayApiV3.EService =
      testToM2mGatewayApiEService(mockEserviceProcessResponse.data);

    const result = await eserviceService.updateEServiceTemplateInstanceLabel(
      unsafeBrandId(mockedApiEservice.id),
      mockSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mEserviceResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient
          .updateEServiceInstanceLabelAfterPublication,
      params: { eServiceId: mockedApiEservice.id },
      body: mockSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEserviceProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the eservice returned by the update POST call has no metadata", async () => {
    mockUpdateLabel.mockResolvedValueOnce({
      ...mockEserviceProcessResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updateEServiceTemplateInstanceLabel(
        unsafeBrandId(mockedApiEservice.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEservice.mockResolvedValueOnce({
      ...mockEserviceProcessResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updateEServiceTemplateInstanceLabel(
        unsafeBrandId(mockedApiEservice.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEservice.mockImplementation(
      mockPollingResponse(
        mockEserviceProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.updateEServiceTemplateInstanceLabel(
        unsafeBrandId(mockedApiEservice.id),
        mockSeed,
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
