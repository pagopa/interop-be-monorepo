import { describe, it, expect, vi, beforeEach } from "vitest";
import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiEservice,
  getMockedApiEserviceDescriptor,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getEserviceDescriptors", () => {
  const mockCatalogProcessDescriptor1 = getMockedApiEserviceDescriptor({
    state: "ARCHIVED",
  });

  const mockCatalogProcessDescriptor2 = getMockedApiEserviceDescriptor({
    state: "ARCHIVED",
  });

  const mockCatalogProcessDescriptor3 = getMockedApiEserviceDescriptor({
    state: "DEPRECATED",
  });

  const mockCatalogProcessDescriptor4 = getMockedApiEserviceDescriptor({
    state: "PUBLISHED",
  });

  const mockCatalogProcessDescriptor5 = getMockedApiEserviceDescriptor({
    state: "DRAFT",
  });

  const mockCatalogProcessResponse = getMockWithMetadata(
    getMockedApiEservice({
      descriptors: [
        mockCatalogProcessDescriptor1,
        mockCatalogProcessDescriptor2,
        mockCatalogProcessDescriptor3,
        mockCatalogProcessDescriptor4,
        mockCatalogProcessDescriptor5,
      ],
    })
  );

  const testToM2MGatewayApiDescriptor = (
    descriptor: catalogApi.EServiceDescriptor
  ): m2mGatewayApiV3.EServiceDescriptor => ({
    id: descriptor.id,
    version: descriptor.version,
    description: descriptor.description,
    audience: descriptor.audience,
    voucherLifespan: descriptor.voucherLifespan,
    dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
    dailyCallsTotal: descriptor.dailyCallsTotal,
    state: descriptor.state,
    agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
    serverUrls: descriptor.serverUrls,
    publishedAt: descriptor.publishedAt,
    suspendedAt: descriptor.suspendedAt,
    deprecatedAt: descriptor.deprecatedAt,
    archivedAt: descriptor.archivedAt,
    templateVersionId: descriptor.templateVersionRef?.id,
  });

  const m2mEserviceDescriptorResponse1: m2mGatewayApiV3.EServiceDescriptor =
    testToM2MGatewayApiDescriptor(mockCatalogProcessDescriptor1);
  const m2mEserviceDescriptorResponse2: m2mGatewayApiV3.EServiceDescriptor =
    testToM2MGatewayApiDescriptor(mockCatalogProcessDescriptor2);
  const m2mEserviceDescriptorResponse3: m2mGatewayApiV3.EServiceDescriptor =
    testToM2MGatewayApiDescriptor(mockCatalogProcessDescriptor3);
  const m2mEserviceDescriptorResponse4: m2mGatewayApiV3.EServiceDescriptor =
    testToM2MGatewayApiDescriptor(mockCatalogProcessDescriptor4);
  const m2mEserviceDescriptorResponse5: m2mGatewayApiV3.EServiceDescriptor =
    testToM2MGatewayApiDescriptor(mockCatalogProcessDescriptor5);

  const mockGetEservice = vi.fn().mockResolvedValue(mockCatalogProcessResponse);

  mockInteropBeClients.catalogProcessClient = {
    getEServiceById: mockGetEservice,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEservice.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mEserviceDescriptorsResponse: m2mGatewayApiV3.EServiceDescriptors = {
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: mockCatalogProcessResponse.data.descriptors.length,
      },
      results: [
        m2mEserviceDescriptorResponse1,
        m2mEserviceDescriptorResponse2,
        m2mEserviceDescriptorResponse3,
        m2mEserviceDescriptorResponse4,
        m2mEserviceDescriptorResponse5,
      ],
    };

    const result = await eserviceService.getEServiceDescriptors(
      unsafeBrandId(mockCatalogProcessResponse.data.id),
      {
        offset: 0,
        limit: 10,
      },
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mEserviceDescriptorsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceById,
      params: { eServiceId: mockCatalogProcessResponse.data.id },
    });
  });

  it("Should apply filters (offset, limit)", async () => {
    const m2mEserviceDescriptorsResponse1: m2mGatewayApiV3.EServiceDescriptors = {
      pagination: {
        offset: 0,
        limit: 2,
        totalCount: mockCatalogProcessResponse.data.descriptors.length,
      },
      results: [m2mEserviceDescriptorResponse1, m2mEserviceDescriptorResponse2],
    };
    const result = await eserviceService.getEServiceDescriptors(
      unsafeBrandId(mockCatalogProcessResponse.data.id),
      {
        offset: 0,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result).toEqual(m2mEserviceDescriptorsResponse1);

    const m2mEserviceDescriptorsResponse2: m2mGatewayApiV3.EServiceDescriptors = {
      pagination: {
        offset: 2,
        limit: 2,
        totalCount: mockCatalogProcessResponse.data.descriptors.length,
      },
      results: [m2mEserviceDescriptorResponse3, m2mEserviceDescriptorResponse4],
    };
    const result2 = await eserviceService.getEServiceDescriptors(
      unsafeBrandId(mockCatalogProcessResponse.data.id),
      {
        offset: 2,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result2).toEqual(m2mEserviceDescriptorsResponse2);

    const m2mEserviceDescriptorsResponse3: m2mGatewayApiV3.EServiceDescriptors = {
      pagination: {
        offset: 4,
        limit: 2,
        totalCount: mockCatalogProcessResponse.data.descriptors.length,
      },
      results: [m2mEserviceDescriptorResponse5],
    };
    const result3 = await eserviceService.getEServiceDescriptors(
      unsafeBrandId(mockCatalogProcessResponse.data.id),
      {
        offset: 4,
        limit: 2,
      },
      getMockM2MAdminAppContext()
    );
    expect(result3).toEqual(m2mEserviceDescriptorsResponse3);
  });

  it("Should apply filters (offset, limit, state)", async () => {
    const m2mEserviceDescriptorsResponse1: m2mGatewayApiV3.EServiceDescriptors = {
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 2,
      },
      results: [m2mEserviceDescriptorResponse1, m2mEserviceDescriptorResponse2],
    };
    const result = await eserviceService.getEServiceDescriptors(
      unsafeBrandId(mockCatalogProcessResponse.data.id),
      {
        state: "ARCHIVED",
        offset: 0,
        limit: 10,
      },
      getMockM2MAdminAppContext()
    );
    expect(result).toEqual(m2mEserviceDescriptorsResponse1);

    const m2mEserviceDescriptorsResponse2: m2mGatewayApiV3.EServiceDescriptors = {
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 1,
      },
      results: [m2mEserviceDescriptorResponse4],
    };
    const result2 = await eserviceService.getEServiceDescriptors(
      unsafeBrandId(mockCatalogProcessResponse.data.id),
      {
        state: "PUBLISHED",
        offset: 0,
        limit: 10,
      },
      getMockM2MAdminAppContext()
    );
    expect(result2).toEqual(m2mEserviceDescriptorsResponse2);
    const m2mEserviceDescriptorsResponse3: m2mGatewayApiV3.EServiceDescriptors = {
      pagination: {
        offset: 0,
        limit: 1,
        totalCount: 2,
      },
      results: [m2mEserviceDescriptorResponse1],
    };
    const result3 = await eserviceService.getEServiceDescriptors(
      unsafeBrandId(mockCatalogProcessResponse.data.id),
      {
        state: "ARCHIVED",
        offset: 0,
        limit: 1,
      },
      getMockM2MAdminAppContext()
    );
    expect(result3).toEqual(m2mEserviceDescriptorsResponse3);
  });
});
