import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
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
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("createTemplateInstanceDescriptor", () => {
  const mockDescriptor = getMockedApiEserviceDescriptor();
  const mockEService = getMockedApiEservice({ descriptors: [mockDescriptor] });

  const mockSeed: m2mGatewayApiV3.EServiceInstanceDescriptorSeed = {
    audience: ["http/test.test"],
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 100,
    agreementApprovalPolicy: "AUTOMATIC",
  };

  const mockCreateDescriptor = vi.fn().mockResolvedValue({
    data: mockDescriptor,
    metadata: { version: 0 },
  });
  const mockGetEService = vi.fn(
    mockPollingResponse(getMockWithMetadata(mockEService), 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    createTemplateInstanceDescriptor: mockCreateDescriptor,
    getEServiceById: mockGetEService,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockCreateDescriptor.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const expectedM2MDescriptor: m2mGatewayApiV3.EServiceDescriptor = {
      id: mockDescriptor.id,
      version: mockDescriptor.version,
      description: mockDescriptor.description,
      audience: mockDescriptor.audience,
      voucherLifespan: mockDescriptor.voucherLifespan,
      dailyCallsPerConsumer: mockDescriptor.dailyCallsPerConsumer,
      dailyCallsTotal: mockDescriptor.dailyCallsTotal,
      state: mockDescriptor.state,
      agreementApprovalPolicy: mockDescriptor.agreementApprovalPolicy,
      serverUrls: mockDescriptor.serverUrls,
      publishedAt: mockDescriptor.publishedAt,
      suspendedAt: mockDescriptor.suspendedAt,
      deprecatedAt: mockDescriptor.deprecatedAt,
      archivedAt: mockDescriptor.archivedAt,
      templateVersionId: mockDescriptor.templateVersionRef?.id,
      archivingSchedule: mockDescriptor.archivingSchedule,
      asyncExchangeProperties: mockDescriptor.asyncExchangeProperties,
    };

    const result = await eserviceService.createTemplateInstanceDescriptor(
      unsafeBrandId(mockEService.id),
      mockSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expectedM2MDescriptor);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient
          .createTemplateInstanceDescriptor,
      params: { eServiceId: mockEService.id },
      body: mockSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the descriptor returned by the creation POST call has no metadata", async () => {
    mockCreateDescriptor.mockResolvedValueOnce({
      data: mockDescriptor,
      metadata: undefined,
    });

    await expect(
      eserviceService.createTemplateInstanceDescriptor(
        unsafeBrandId(mockEService.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce({
      data: mockEService,
      metadata: undefined,
    });

    await expect(
      eserviceService.createTemplateInstanceDescriptor(
        unsafeBrandId(mockEService.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockImplementation(
      mockPollingResponse(
        getMockWithMetadata(mockEService),
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.createTemplateInstanceDescriptor(
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
