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

describe("updatePublishedEServiceDescriptorQuotas", () => {
  const mockDescriptor = getMockedApiEserviceDescriptor();
  const mockEService = getMockedApiEservice({
    descriptors: [mockDescriptor, getMockedApiEserviceDescriptor()],
  });
  const mockEServiceProcessGetResponse = getMockWithMetadata(mockEService);

  const mockSeed: m2mGatewayApiV3.EServiceDescriptorQuotasUpdateSeed = {
    voucherLifespan: 3600,
    dailyCallsPerConsumer: 1000,
    dailyCallsTotal: 10000,
  };

  const pollingTentatives = 2;
  const mockUpdateEServiceDescriptorQuotas = vi
    .fn()
    .mockResolvedValue(mockEServiceProcessGetResponse);
  const mockGetEService = vi.fn(
    mockPollingResponse(mockEServiceProcessGetResponse, pollingTentatives)
  );

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEService,
    updateDescriptor: mockUpdateEServiceDescriptorQuotas,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockUpdateEServiceDescriptorQuotas.mockClear();
    mockGetEService.mockClear();
  });

  it("Should succeed and perform service calls", async () => {
    mockGetEService.mockResolvedValueOnce(mockEServiceProcessGetResponse);

    const result =
      await eserviceService.updatePublishedEServiceDescriptorQuotas(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        mockSeed,
        getMockM2MAdminAppContext()
      );

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
    };

    expect(result).toStrictEqual(expectedM2MDescriptor);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.updateDescriptor,
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
    expectApiClientGetToHaveBeenNthCalledWith({
      nthCall: pollingTentatives + 1,
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockEService.id },
    });
    expect(
      mockInteropBeClients.catalogProcessClient.getEServiceById
    ).toHaveBeenCalledTimes(pollingTentatives + 1);
  });

  it.each([
    {
      voucherLifespan: 3600,
    },
    {
      dailyCallsPerConsumer: 1000,
    },
    { dailyCallsTotal: 10000 },
    {
      voucherLifespan: 3600,
      dailyCallsPerConsumer: 1000,
    },
    {
      voucherLifespan: 3600,
      dailyCallsTotal: 10000,
    },
    {
      dailyCallsPerConsumer: 1000,
      dailyCallsTotal: 10000,
    },
  ])("Should apply patch logic when seed is partial", async (seed) => {
    mockGetEService.mockResolvedValueOnce(mockEServiceProcessGetResponse);

    const result =
      await eserviceService.updatePublishedEServiceDescriptorQuotas(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        seed,
        getMockM2MAdminAppContext()
      );

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
    };

    expect(result).toStrictEqual(expectedM2MDescriptor);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost: mockInteropBeClients.catalogProcessClient.updateDescriptor,
      params: {
        eServiceId: mockEService.id,
        descriptorId: mockDescriptor.id,
      },
      body: {
        voucherLifespan: seed.voucherLifespan ?? mockDescriptor.voucherLifespan,
        dailyCallsPerConsumer:
          seed.dailyCallsPerConsumer ?? mockDescriptor.dailyCallsPerConsumer,
        dailyCallsTotal: seed.dailyCallsTotal ?? mockDescriptor.dailyCallsTotal,
      },
    });
  });

  it("Should throw missingMetadata in case the eservice returned by the PATCH call has no metadata", async () => {
    mockGetEService.mockResolvedValueOnce(mockEServiceProcessGetResponse);
    mockUpdateEServiceDescriptorQuotas.mockResolvedValueOnce({
      ...mockEServiceProcessGetResponse,
      metadata: undefined,
    });

    await expect(
      eserviceService.updatePublishedEServiceDescriptorQuotas(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        mockSeed,
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
      eserviceService.updatePublishedEServiceDescriptorQuotas(
        unsafeBrandId(mockEService.id),
        unsafeBrandId(mockDescriptor.id),
        mockSeed,
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
      eserviceService.updatePublishedEServiceDescriptorQuotas(
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
      config.defaultPollingMaxRetries + 1
    );
  });
});
