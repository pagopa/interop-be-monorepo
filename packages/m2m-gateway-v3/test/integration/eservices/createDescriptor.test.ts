import { describe, it, expect, vi, beforeEach } from "vitest";
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  EServiceId,
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
import {
  eserviceDescriptorNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("createDescriptor", () => {
  const descriptorSeed: m2mGatewayApiV3.EServiceDescriptorSeed = {
    description: "Test Descriptor",
    audience: ["http/test.test"],
    voucherLifespan: 100,
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 10,
    agreementApprovalPolicy: "AUTOMATIC",
  };

  const mockDescriptor = getMockedApiEserviceDescriptor();
  const mockEService = getMockedApiEservice({
    descriptors: [mockDescriptor],
  });

  const mockCreateResponseData: catalogApi.CreatedEServiceDescriptor = {
    eservice: mockEService,
    createdDescriptorId: mockEService.descriptors[0].id,
  };
  const mockcreateDescriptor = vi.fn().mockResolvedValue({
    data: mockCreateResponseData,
    metadata: { version: 0 },
  });
  const mockGetEService = vi.fn(
    mockPollingResponse(getMockWithMetadata(mockEService), 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    createDescriptor: mockcreateDescriptor,
    getEServiceById: mockGetEService,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockcreateDescriptor.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mEserviceDescriptorResponse: m2mGatewayApiV3.EServiceDescriptor = {
      id: mockDescriptor.id,
      description: mockDescriptor.description,
      state: mockDescriptor.state,
      version: mockDescriptor.version,
      serverUrls: mockDescriptor.serverUrls,
      audience: mockDescriptor.audience,
      voucherLifespan: mockDescriptor.voucherLifespan,
      dailyCallsPerConsumer: mockDescriptor.dailyCallsPerConsumer,
      dailyCallsTotal: mockDescriptor.dailyCallsTotal,
      agreementApprovalPolicy: mockDescriptor.agreementApprovalPolicy,
      archivedAt: mockDescriptor.archivedAt,
      deprecatedAt: mockDescriptor.deprecatedAt,
      publishedAt: mockDescriptor.publishedAt,
      suspendedAt: mockDescriptor.suspendedAt,
      templateVersionId: mockDescriptor.templateVersionRef?.id,
    };

    const result = await eserviceService.createDescriptor(
      mockEService.id as EServiceId,
      descriptorSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mEserviceDescriptorResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.createDescriptor,
      params: { eServiceId: mockEService.id },
      body: {
        ...descriptorSeed,
        attributes: {
          certified: [],
          declared: [],
          verified: [],
        },
        docs: [],
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the attribute returned by the creation POST call has no metadata", async () => {
    mockcreateDescriptor.mockResolvedValueOnce({
      data: mockCreateResponseData,
      metadata: undefined,
    });

    await expect(
      eserviceService.createDescriptor(
        mockEService.id as EServiceId,
        descriptorSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the attribute returned by the polling GET call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce({
      data: mockEService,
      metadata: undefined,
    });

    await expect(
      eserviceService.createDescriptor(
        mockEService.id as EServiceId,
        descriptorSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw eserviceDescriptorNotFound in case of descriptor missing in eservice returned by the process", async () => {
    const eserviceWithoutDescriptor = getMockWithMetadata({
      ...mockEService,
      descriptors: [],
    });
    mockcreateDescriptor.mockResolvedValueOnce({
      data: {
        eservice: eserviceWithoutDescriptor.data,
        createdDescriptorId: mockDescriptor.id,
      } satisfies catalogApi.CreatedEServiceDescriptor,
      metadata: { version: 0 },
    });

    await expect(
      eserviceService.createDescriptor(
        mockEService.id as EServiceId,
        descriptorSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorNotFound(
        unsafeBrandId(mockEService.id),
        mockDescriptor.id
      )
    );
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockImplementation(
      mockPollingResponse(
        getMockWithMetadata(mockEService),
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.createDescriptor(
        mockEService.id as EServiceId,
        descriptorSeed,
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
