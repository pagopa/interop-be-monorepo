import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  DescriptorId,
  generateId,
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import {
  eserviceDescriptorNotFound,
  invalidSeedForEServiceTemplateInstance,
  missingMetadata,
} from "../../../src/model/errors.js";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientGetToHaveBeenNthCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
  eserviceService,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("updateDraftEService", () => {
  const mockDescriptor = getMockedApiEserviceDescriptor();
  const mockEServiceWithTemplate = getMockedApiEservice({
    descriptors: [mockDescriptor, getMockedApiEserviceDescriptor()],
  });
  const mockEService = {
    ...mockEServiceWithTemplate,
    templateId: undefined,
  };
  const mockEServiceProcessGetResponseWithTemplate = getMockWithMetadata(
    mockEServiceWithTemplate
  );
  const mockEServiceProcessGetResponse = getMockWithMetadata(mockEService);

  const descriptorSeed: m2mGatewayApiV3.EServiceDescriptorDraftUpdateSeed = {
    description: "Test Descriptor",
    audience: ["http/test.test"],
    voucherLifespan: 100,
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 10,
    agreementApprovalPolicy: "AUTOMATIC",
  };
  const templateInstanceDescriptorSeed: m2mGatewayApiV3.UpdateEServiceDescriptorTemplateInstanceSeed =
    {
      audience: ["http/test.test"],
      dailyCallsPerConsumer: 10,
      dailyCallsTotal: 100,
      agreementApprovalPolicy: "AUTOMATIC",
    };

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
    delegatedArchivingRequest: mockDescriptor.delegatedArchivingRequest,
  };

  const mockPatchUpdateDescriptor = vi
    .fn()
    .mockResolvedValue(mockEServiceProcessGetResponse);
  const mockUpdateDraftDescriptorTemplateInstance = vi
    .fn()
    .mockResolvedValue(mockEServiceProcessGetResponseWithTemplate);
  const mockGetEService = vi.fn();

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    patchUpdateDraftDescriptor: mockPatchUpdateDescriptor,
    updateDraftDescriptorTemplateInstance:
      mockUpdateDraftDescriptorTemplateInstance,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockPatchUpdateDescriptor.mockClear();
    mockUpdateDraftDescriptorTemplateInstance.mockClear();
    mockGetEService.mockReset();
  });

  it("Should succeed and perform service calls", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockEServiceProcessGetResponse)
      .mockImplementation(
        mockPollingResponse(mockEServiceProcessGetResponse, 2)
      );

    const result = await eserviceService.updateDraftEServiceDescriptor(
      unsafeBrandId(mockEService.id),
      unsafeBrandId(mockDescriptor.id),
      descriptorSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expectedM2MDescriptor);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient.patchUpdateDraftDescriptor,
      params: {
        eServiceId: mockEService.id,
        descriptorId: mockDescriptor.id,
      },
      body: descriptorSeed,
    });
    expect(
      mockInteropBeClients.catalogProcessClient
        .updateDraftDescriptorTemplateInstance
    ).toHaveBeenCalledTimes(0);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: 3,
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(3);
  });

  it("Should succeed and perform service calls for eservice created from template", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockEServiceProcessGetResponseWithTemplate)
      .mockImplementation(
        mockPollingResponse(mockEServiceProcessGetResponseWithTemplate, 2)
      );

    const result = await eserviceService.updateDraftEServiceDescriptor(
      unsafeBrandId(mockEServiceWithTemplate.id),
      unsafeBrandId(mockDescriptor.id),
      templateInstanceDescriptorSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expectedM2MDescriptor);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient
          .updateDraftDescriptorTemplateInstance,
      params: {
        eServiceId: mockEServiceWithTemplate.id,
        descriptorId: mockDescriptor.id,
      },
      body: templateInstanceDescriptorSeed,
    });
    expect(
      mockInteropBeClients.catalogProcessClient.patchUpdateDraftDescriptor
    ).toHaveBeenCalledTimes(0);
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(3);
  });

  it("Should throw invalidSeedForEServiceTemplateInstance when the update seed is not for an eservice created from template", async () => {
    mockGetEService.mockResolvedValueOnce(
      mockEServiceProcessGetResponseWithTemplate
    );

    await expect(
      eserviceService.updateDraftEServiceDescriptor(
        unsafeBrandId(mockEServiceWithTemplate.id),
        unsafeBrandId(mockDescriptor.id),
        descriptorSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      invalidSeedForEServiceTemplateInstance(
        m2mGatewayApiV3.UpdateEServiceDescriptorTemplateInstanceSeed.safeParse(
          descriptorSeed
        ).error!.issues.map((i) => i.message)
      )
    );

    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(1);
  });

  it("Should throw eserviceDescriptorNotFound in case the returned eservice has no descriptor with the given id", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockEServiceProcessGetResponse)
      .mockImplementation(
        mockPollingResponse(mockEServiceProcessGetResponse, 1)
      );
    const nonExistingDescriptorId = generateId<DescriptorId>();
    await expect(
      eserviceService.updateDraftEServiceDescriptor(
        unsafeBrandId(mockEService.id),
        nonExistingDescriptorId,
        descriptorSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorNotFound(mockEService.id, nonExistingDescriptorId)
    );
  });

  it("Should throw missingMetadata in case the eservice returned by the PATCH call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(mockEServiceProcessGetResponse);
    mockPatchUpdateDescriptor.mockResolvedValueOnce({
      ...mockEServiceProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updateDraftEServiceDescriptor(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        descriptorSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice created from template returned by the update call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(
      mockEServiceProcessGetResponseWithTemplate
    );
    mockUpdateDraftDescriptorTemplateInstance.mockResolvedValueOnce({
      ...mockEServiceProcessGetResponseWithTemplate,
      metadata: undefined,
    });

    await expect(
      eserviceService.updateDraftEServiceDescriptor(
        unsafeBrandId(mockEServiceWithTemplate.id),
        unsafeBrandId(mockDescriptor.id),
        templateInstanceDescriptorSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockEServiceProcessGetResponse)
      .mockResolvedValueOnce({
        ...mockEServiceProcessGetResponse,
        metadata: undefined,
      });

    await expect(
      eserviceService.updateDraftEServiceDescriptor(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        descriptorSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService
      .mockResolvedValueOnce(mockEServiceProcessGetResponse)
      .mockImplementation(
        mockPollingResponse(
          mockEServiceProcessGetResponse,
          config.defaultPollingMaxRetries + 1
        )
      );

    await expect(
      eserviceService.updateDraftEServiceDescriptor(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
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
