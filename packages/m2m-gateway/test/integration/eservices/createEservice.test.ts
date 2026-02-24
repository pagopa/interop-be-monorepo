import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
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

describe("createEService", () => {
  const mockedApiEservice = getMockedApiEservice();

  const mockApiEserviceWithDescriptor: m2mGatewayApi.DescriptorSeedForEServiceCreation =
    {
      audience: [],
      voucherLifespan: 1000,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 100,
      agreementApprovalPolicy: "AUTOMATIC",
    };

  const mockEserviceSeed: m2mGatewayApi.EServiceSeed = {
    name: mockedApiEservice.name,
    description: mockedApiEservice.description,
    technology: mockedApiEservice.technology,
    mode: mockedApiEservice.mode,
    descriptor: mockApiEserviceWithDescriptor,
  };

  const mockEserviceProcessResponse = getMockWithMetadata(mockedApiEservice);

  const mockCreateEService = vi
    .fn()
    .mockResolvedValue(mockEserviceProcessResponse);

  const mockGetEservice = vi.fn(
    mockPollingResponse(mockEserviceProcessResponse, 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    createEService: mockCreateEService,
    getEServiceById: mockGetEservice,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockCreateEService.mockClear();
    mockGetEservice.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mEserviceResponse: m2mGatewayApi.EService =
      testToM2mGatewayApiEService(mockEserviceProcessResponse.data);

    const result = await eserviceService.createEService(
      mockEserviceSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mEserviceResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.createEService,
      body: mockEserviceSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEserviceProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the attribute returned by the creation POST call has no metadata", async () => {
    mockCreateEService.mockResolvedValueOnce({
      ...mockEserviceProcessResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.createEService(
        mockEserviceSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the attribute returned by the polling GET call has no metadata", async () => {
    mockGetEservice.mockResolvedValueOnce({
      ...mockEserviceProcessResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.createEService(
        mockEserviceSeed,
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
      eserviceService.createEService(
        mockEserviceSeed,
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
