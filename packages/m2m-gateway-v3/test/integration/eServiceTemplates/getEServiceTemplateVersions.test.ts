import { describe, it, expect, vi, beforeEach } from "vitest";
import { eserviceTemplateApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getEServiceTemplateVersions", () => {
  const mockParams: m2mGatewayApiV3.GetEServiceTemplateVersionsQueryParams = {
    state: undefined,
    offset: 0,
    limit: 10,
  };

  const mockApiTemplateVersion1 = getMockedApiEserviceTemplateVersion({
    state: eserviceTemplateApi.EServiceTemplateVersionState.Enum.DRAFT,
  });
  const mockApiTemplateVersion2 = getMockedApiEserviceTemplateVersion({
    state: eserviceTemplateApi.EServiceTemplateVersionState.Enum.DEPRECATED,
  });
  const mockApiTemplateVersion3 = getMockedApiEserviceTemplateVersion({
    state: eserviceTemplateApi.EServiceTemplateVersionState.Enum.DRAFT,
  });
  const mockApiTemplateVersion4 = getMockedApiEserviceTemplateVersion({
    state: eserviceTemplateApi.EServiceTemplateVersionState.Enum.PUBLISHED,
  });
  const mockApiTemplateVersion5 = getMockedApiEserviceTemplateVersion({
    state: eserviceTemplateApi.EServiceTemplateVersionState.Enum.SUSPENDED,
  });

  const mockApiTemplate = getMockWithMetadata(
    getMockedApiEServiceTemplate({
      versions: [
        mockApiTemplateVersion1,
        mockApiTemplateVersion2,
        mockApiTemplateVersion3,
        mockApiTemplateVersion4,
        mockApiTemplateVersion5,
      ],
    })
  );

  const mockGetTemplate = vi.fn().mockResolvedValue(mockApiTemplate);

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockGetTemplate.mockClear();
  });

  const testToM2MGatewayApiEServiceTemplateVersion = (
    template: eserviceTemplateApi.EServiceTemplateVersion
  ): m2mGatewayApiV3.EServiceTemplateVersion => ({
    id: template.id,
    state: template.state,
    version: template.version,
    voucherLifespan: template.voucherLifespan,
    agreementApprovalPolicy: template.agreementApprovalPolicy,
    dailyCallsPerConsumer: template.dailyCallsPerConsumer,
    dailyCallsTotal: template.dailyCallsTotal,
    deprecatedAt: template.deprecatedAt,
    description: template.description,
    publishedAt: template.publishedAt,
    suspendedAt: template.suspendedAt,
  });

  const expectedM2MTemplateVersion1 =
    testToM2MGatewayApiEServiceTemplateVersion(mockApiTemplateVersion1);
  const expectedM2MTemplateVersion2 =
    testToM2MGatewayApiEServiceTemplateVersion(mockApiTemplateVersion2);
  const expectedM2MTemplateVersion3 =
    testToM2MGatewayApiEServiceTemplateVersion(mockApiTemplateVersion3);
  const expectedM2MTemplateVersion4 =
    testToM2MGatewayApiEServiceTemplateVersion(mockApiTemplateVersion4);
  const expectedM2MTemplateVersion5 =
    testToM2MGatewayApiEServiceTemplateVersion(mockApiTemplateVersion5);

  it("Should succeed and perform API clients calls", async () => {
    const m2mTemplateResponse: m2mGatewayApiV3.EServiceTemplateVersions = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockApiTemplate.data.versions.length,
      },
      results: [
        expectedM2MTemplateVersion1,
        expectedM2MTemplateVersion2,
        expectedM2MTemplateVersion3,
        expectedM2MTemplateVersion4,
        expectedM2MTemplateVersion5,
      ],
    };

    const result = await eserviceTemplateService.getEServiceTemplateVersions(
      unsafeBrandId(mockApiTemplate.data.id),
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mTemplateResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: {
        templateId: mockApiTemplate.data.id,
      },
    });
  });

  it("Should correctly apply pagination from the retrieved template (offset, limit)", async () => {
    const expectedM2MTemplateVersion: m2mGatewayApiV3.EServiceTemplateVersion = {
      id: mockApiTemplateVersion2.id,
      state: mockApiTemplateVersion2.state,
      version: mockApiTemplateVersion2.version,
      voucherLifespan: mockApiTemplateVersion2.voucherLifespan,
      agreementApprovalPolicy: mockApiTemplateVersion2.agreementApprovalPolicy,
      dailyCallsPerConsumer: mockApiTemplateVersion2.dailyCallsPerConsumer,
      dailyCallsTotal: mockApiTemplateVersion2.dailyCallsTotal,
      deprecatedAt: mockApiTemplateVersion2.deprecatedAt,
      description: mockApiTemplateVersion2.description,
      publishedAt: mockApiTemplateVersion2.publishedAt,
      suspendedAt: mockApiTemplateVersion2.suspendedAt,
    };
    const m2mTemplateResponse: m2mGatewayApiV3.EServiceTemplateVersions = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: 1,
      },
      results: [expectedM2MTemplateVersion],
    };

    const result = await eserviceTemplateService.getEServiceTemplateVersions(
      unsafeBrandId(mockApiTemplate.data.id),
      {
        offset: 0,
        limit: 10,
        state: "DEPRECATED",
      },
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mTemplateResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: {
        templateId: mockApiTemplate.data.id,
      },
    });
  });
});
