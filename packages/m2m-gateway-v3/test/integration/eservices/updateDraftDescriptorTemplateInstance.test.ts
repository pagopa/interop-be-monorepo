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
import {
  eserviceDescriptorNotFound,
  missingMetadata,
} from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("updateDraftDescriptorTemplateInstance", () => {
  const mockDescriptor = getMockedApiEserviceDescriptor();
  const mockEService = getMockedApiEservice({ descriptors: [mockDescriptor] });
  const mockEServiceProcessResponse = getMockWithMetadata(mockEService);

  const mockSeed: m2mGatewayApiV3.UpdateEServiceDescriptorTemplateInstanceSeed =
    {
      audience: ["http/test.test"],
      dailyCallsPerConsumer: 10,
      dailyCallsTotal: 100,
      agreementApprovalPolicy: "AUTOMATIC",
    };

  const mockUpdateDraftDescriptor = vi
    .fn()
    .mockResolvedValue(mockEServiceProcessResponse);
  const mockGetEService = vi.fn(
    mockPollingResponse(mockEServiceProcessResponse, 2)
  );

  mockInteropBeClients.catalogProcessClient = {
    updateDraftDescriptorTemplateInstance: mockUpdateDraftDescriptor,
    getEServiceById: mockGetEService,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockUpdateDraftDescriptor.mockClear();
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

    const result = await eserviceService.updateDraftDescriptorTemplateInstance(
      unsafeBrandId(mockEService.id),
      unsafeBrandId(mockDescriptor.id),
      mockSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expectedM2MDescriptor);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.catalogProcessClient
          .updateDraftDescriptorTemplateInstance,
      params: {
        eServiceId: mockEService.id,
        descriptorId: mockDescriptor.id,
      },
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

  it("Should throw eserviceDescriptorNotFound when the descriptor is missing in the returned eservice", async () => {
    const eserviceWithoutDescriptor = getMockWithMetadata({
      ...mockEService,
      descriptors: [],
    });
    mockUpdateDraftDescriptor.mockResolvedValueOnce(eserviceWithoutDescriptor);
    mockGetEService.mockImplementation(
      mockPollingResponse(eserviceWithoutDescriptor, 1)
    );

    await expect(
      eserviceService.updateDraftDescriptorTemplateInstance(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorNotFound(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id)
      )
    );
  });

  it("Should throw missingMetadata in case the eservice returned by the update POST call has no metadata", async () => {
    mockUpdateDraftDescriptor.mockResolvedValueOnce({
      ...mockEServiceProcessResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updateDraftDescriptorTemplateInstance(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the eservice returned by the polling GET call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce({
      ...mockEServiceProcessResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updateDraftDescriptorTemplateInstance(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        mockSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEService.mockImplementation(
      mockPollingResponse(
        mockEServiceProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceService.updateDraftDescriptorTemplateInstance(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
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
