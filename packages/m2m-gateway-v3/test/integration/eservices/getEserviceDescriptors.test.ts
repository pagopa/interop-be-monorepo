import { catalogApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiEserviceDescriptor,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getEserviceDescriptors", () => {
  const eserviceId = generateId();

  const mockDescriptor1 = getMockedApiEserviceDescriptor({
    state: "PUBLISHED",
  });
  const mockDescriptor2 = getMockedApiEserviceDescriptor({ state: "ARCHIVED" });

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
    archivingSchedule: descriptor.archivingSchedule,
    asyncExchangeProperties: descriptor.asyncExchangeProperties,
  });

  // Pagination (and descriptor visibility) is now performed by catalog-process:
  // the gateway only forwards the query params and maps the paginated results.
  const mockProcessResponse = getMockWithMetadata({
    results: [mockDescriptor1, mockDescriptor2],
    totalCount: 5,
  });

  const mockGetEServiceDescriptors = vi
    .fn()
    .mockResolvedValue(mockProcessResponse);

  mockInteropBeClients.catalogProcessClient = {
    getEServiceDescriptors: mockGetEServiceDescriptors,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    mockGetEServiceDescriptors.mockClear();
  });

  it("Should delegate pagination to catalog-process and map the results", async () => {
    const expected: m2mGatewayApiV3.EServiceDescriptors = {
      results: [
        testToM2MGatewayApiDescriptor(mockDescriptor1),
        testToM2MGatewayApiDescriptor(mockDescriptor2),
      ],
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 5,
      },
    };

    const result = await eserviceService.getEServiceDescriptors(
      unsafeBrandId(eserviceId),
      { state: undefined, offset: 0, limit: 10 },
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expected);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceDescriptors,
      params: { eServiceId: eserviceId },
      queries: { state: undefined, offset: 0, limit: 10 },
    });
  });

  it("Should forward the state filter and pagination params to the process", async () => {
    await eserviceService.getEServiceDescriptors(
      unsafeBrandId(eserviceId),
      { state: "PUBLISHED", offset: 2, limit: 2 },
      getMockM2MAdminAppContext()
    );

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceDescriptors,
      params: { eServiceId: eserviceId },
      queries: { state: "PUBLISHED", offset: 2, limit: 2 },
    });
  });
});
