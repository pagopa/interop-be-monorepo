import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  EServiceId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  eserviceDescriptorNotFound,
  invalidSeedForEService,
  invalidSeedForEServiceTemplateInstance,
  missingMetadata,
} from "../../../src/model/errors.js";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
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
  const templateInstanceDescriptorSeed: m2mGatewayApiV3.EServiceInstanceDescriptorSeed =
    {
      audience: ["http/test.test"],
      dailyCallsPerConsumer: 10,
      dailyCallsTotal: 100,
      agreementApprovalPolicy: "AUTOMATIC",
    };

  const mockDescriptor = getMockedApiEserviceDescriptor();
  const mockEServiceWithTemplate = getMockedApiEservice({
    descriptors: [mockDescriptor],
  });
  const mockEService = {
    ...mockEServiceWithTemplate,
    templateId: undefined,
  };

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
    archivingSchedule: mockDescriptor.archivingSchedule,
    asyncExchangeProperties: mockDescriptor.asyncExchangeProperties,
    delegatedArchivingRequest: mockDescriptor.delegatedArchivingRequest,
  };

  const mockCreateResponseData: catalogApi.CreatedEServiceDescriptor = {
    eservice: mockEService,
    createdDescriptorId: mockEService.descriptors[0].id,
  };
  const mockcreateDescriptor = vi.fn().mockResolvedValue({
    data: mockCreateResponseData,
    metadata: { version: 0 },
  });
  const mockCreateTemplateInstanceDescriptor = vi.fn().mockResolvedValue({
    data: mockDescriptor,
    metadata: { version: 0 },
  });
  const mockGetEService = vi.fn();

  mockInteropBeClients.catalogProcessClient = {
    createDescriptor: mockcreateDescriptor,
    createTemplateInstanceDescriptor: mockCreateTemplateInstanceDescriptor,
    getEServiceById: mockGetEService,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockcreateDescriptor.mockClear();
    mockCreateTemplateInstanceDescriptor.mockClear();
    mockGetEService.mockReset();
  });

  it("Should succeed and perform API clients calls", async () => {
    mockGetEService
      .mockResolvedValueOnce(getMockWithMetadata(mockEService))
      .mockImplementation(
        mockPollingResponse(getMockWithMetadata(mockEService), 2)
      );

    const result = await eserviceService.createDescriptor(
      mockEService.id as EServiceId,
      descriptorSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mEserviceDescriptorResponse);
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
    expect(
      mockInteropBeClients.catalogProcessClient.createTemplateInstanceDescriptor
    ).toHaveBeenCalledTimes(0);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(3);
  });

  it("Should succeed and perform API clients calls for eservice created from template", async () => {
    mockGetEService
      .mockResolvedValueOnce(getMockWithMetadata(mockEServiceWithTemplate))
      .mockImplementation(
        mockPollingResponse(getMockWithMetadata(mockEServiceWithTemplate), 2)
      );

    const result = await eserviceService.createDescriptor(
      unsafeBrandId(mockEServiceWithTemplate.id),
      templateInstanceDescriptorSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mEserviceDescriptorResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient
          .createTemplateInstanceDescriptor,
      params: { eServiceId: mockEServiceWithTemplate.id },
      body: templateInstanceDescriptorSeed,
    });
    expect(
      mockInteropBeClients.catalogProcessClient.createDescriptor
    ).toHaveBeenCalledTimes(0);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEServiceWithTemplate.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(3);
  });

  it("Should throw invalidSeedForEServiceTemplateInstance when the seed is not for an eservice created from template", async () => {
    mockGetEService.mockResolvedValueOnce(
      getMockWithMetadata(mockEServiceWithTemplate)
    );

    await expect(
      eserviceService.createDescriptor(
        unsafeBrandId(mockEServiceWithTemplate.id),
        descriptorSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      invalidSeedForEServiceTemplateInstance(
        m2mGatewayApiV3.EServiceInstanceDescriptorSeed.safeParse(
          descriptorSeed
        ).error!.issues.map((i) => i.message)
      )
    );

    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(1);
  });

  it("Should throw invalidSeedForEService when the seed is for an eservice created from template but the eservice is not", async () => {
    mockGetEService.mockResolvedValueOnce(getMockWithMetadata(mockEService));

    await expect(
      eserviceService.createDescriptor(
        mockEService.id as EServiceId,
        templateInstanceDescriptorSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      invalidSeedForEService(
        m2mGatewayApiV3.EServiceDescriptorSeed.safeParse(
          templateInstanceDescriptorSeed
        ).error!.issues.map((i) => i.message)
      )
    );

    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(1);
  });

  it("Should throw missingMetadata in case the attribute returned by the creation POST call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(getMockWithMetadata(mockEService));
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

  it("Should throw missingMetadata in case the descriptor of an eservice created from template returned by the creation POST call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(
      getMockWithMetadata(mockEServiceWithTemplate)
    );
    mockCreateTemplateInstanceDescriptor.mockResolvedValueOnce({
      data: mockDescriptor,
      metadata: undefined,
    });

    await expect(
      eserviceService.createDescriptor(
        unsafeBrandId(mockEServiceWithTemplate.id),
        templateInstanceDescriptorSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the attribute returned by the polling GET call has no metadata", async () => {
    mockGetEService
      .mockResolvedValueOnce(getMockWithMetadata(mockEService))
      .mockResolvedValueOnce({
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
    mockGetEService
      .mockResolvedValueOnce(getMockWithMetadata(mockEService))
      .mockImplementation(
        mockPollingResponse(getMockWithMetadata(mockEService), 1)
      );
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
    mockGetEService
      .mockResolvedValueOnce(getMockWithMetadata(mockEService))
      .mockImplementation(
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
      config.defaultPollingMaxRetries + 1
    );
  });
});
