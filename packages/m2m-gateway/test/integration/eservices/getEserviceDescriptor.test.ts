import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { DescriptorId, generateId, unsafeBrandId } from "pagopa-interop-models";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
} from "../../mockUtils.js";
import { eserviceDescriptorNotFound } from "../../../src/model/errors.js";

describe("getEserviceDescriptor", () => {
  const mockCatalogProcessResponseDescriptor =
    getMockedApiEserviceDescriptor().data;
  const mockCatalogProcessResponse = getMockedApiEservice({
    descriptors: [
      mockCatalogProcessResponseDescriptor,
      getMockedApiEserviceDescriptor().data,
    ],
  });
  const mockGetEservice = vi.fn().mockResolvedValue(mockCatalogProcessResponse);

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEservice,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEservice.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mEserviceDescriptorResponse: m2mGatewayApi.EServiceDescriptor = {
      id: mockCatalogProcessResponseDescriptor.id,
      version: mockCatalogProcessResponseDescriptor.version,
      description: mockCatalogProcessResponseDescriptor.description,
      audience: mockCatalogProcessResponseDescriptor.audience,
      voucherLifespan: mockCatalogProcessResponseDescriptor.voucherLifespan,
      dailyCallsPerConsumer:
        mockCatalogProcessResponseDescriptor.dailyCallsPerConsumer,
      dailyCallsTotal: mockCatalogProcessResponseDescriptor.dailyCallsTotal,
      state: mockCatalogProcessResponseDescriptor.state,
      agreementApprovalPolicy:
        mockCatalogProcessResponseDescriptor.agreementApprovalPolicy,
      serverUrls: mockCatalogProcessResponseDescriptor.serverUrls,
      publishedAt: mockCatalogProcessResponseDescriptor.publishedAt,
      suspendedAt: mockCatalogProcessResponseDescriptor.suspendedAt,
      deprecatedAt: mockCatalogProcessResponseDescriptor.deprecatedAt,
      archivedAt: mockCatalogProcessResponseDescriptor.archivedAt,
      templateVersionId:
        mockCatalogProcessResponseDescriptor.templateVersionRef?.id,
    };

    const result = await eserviceService.getEServiceDescriptor(
      unsafeBrandId(mockCatalogProcessResponse.data.id),
      unsafeBrandId(mockCatalogProcessResponseDescriptor.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mEserviceDescriptorResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockCatalogProcessResponse.data.id },
    });
  });

  it("Should throw eserviceDescriptorNotFound in case the returned eservice has no descriptor with the given id", async () => {
    const nonExistingDescriptorId = generateId<DescriptorId>();
    await expect(
      eserviceService.getEServiceDescriptor(
        unsafeBrandId(mockCatalogProcessResponse.data.id),
        nonExistingDescriptorId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorNotFound(
        mockCatalogProcessResponse.data.id,
        nonExistingDescriptorId
      )
    );
  });
});
