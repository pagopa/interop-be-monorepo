import {
  eserviceTemplateApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import {
  getMockedApiEserviceTemplateVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getEServiceTemplateVersions", () => {
  const templateId = generateId();

  const mockApiTemplateVersion1 = getMockedApiEserviceTemplateVersion({
    state: eserviceTemplateApi.EServiceTemplateVersionState.Enum.PUBLISHED,
  });
  const mockApiTemplateVersion2 = getMockedApiEserviceTemplateVersion({
    state: eserviceTemplateApi.EServiceTemplateVersionState.Enum.SUSPENDED,
  });

  const testToM2MGatewayApiTemplateVersion = (
    version: eserviceTemplateApi.EServiceTemplateVersion
  ): m2mGatewayApiV3.EServiceTemplateVersion => ({
    id: version.id,
    state: version.state,
    version: version.version,
    voucherLifespan: version.voucherLifespan,
    agreementApprovalPolicy: version.agreementApprovalPolicy,
    dailyCallsPerConsumer: version.dailyCallsPerConsumer,
    dailyCallsTotal: version.dailyCallsTotal,
    deprecatedAt: version.deprecatedAt,
    description: version.description,
    publishedAt: version.publishedAt,
    suspendedAt: version.suspendedAt,
    asyncExchangeProperties: version.asyncExchangeProperties,
  });

  // Pagination (and version visibility) is now performed by
  // eservice-template-process.
  const mockProcessResponse = getMockWithMetadata({
    results: [mockApiTemplateVersion1, mockApiTemplateVersion2],
    totalCount: 5,
  });

  const mockGetEServiceTemplateVersions = vi
    .fn()
    .mockResolvedValue(mockProcessResponse);

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateVersions: mockGetEServiceTemplateVersions,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockGetEServiceTemplateVersions.mockClear();
  });

  it("Should delegate pagination to eservice-template-process and map the results", async () => {
    const expected: m2mGatewayApiV3.EServiceTemplateVersions = {
      results: [
        testToM2MGatewayApiTemplateVersion(mockApiTemplateVersion1),
        testToM2MGatewayApiTemplateVersion(mockApiTemplateVersion2),
      ],
      pagination: {
        offset: 0,
        limit: 10,
        totalCount: 5,
      },
    };

    const result = await eserviceTemplateService.getEServiceTemplateVersions(
      unsafeBrandId(templateId),
      { state: undefined, offset: 0, limit: 10 },
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(expected);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateVersions,
      params: { templateId },
      queries: { state: undefined, offset: 0, limit: 10 },
    });
  });

  it("Should forward the state filter and pagination params to the process", async () => {
    await eserviceTemplateService.getEServiceTemplateVersions(
      unsafeBrandId(templateId),
      { state: "PUBLISHED", offset: 2, limit: 2 },
      getMockM2MAdminAppContext()
    );

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateVersions,
      params: { templateId },
      queries: { state: "PUBLISHED", offset: 2, limit: 2 },
    });
  });
});
