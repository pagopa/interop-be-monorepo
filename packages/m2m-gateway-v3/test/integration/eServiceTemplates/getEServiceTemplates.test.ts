import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  eserviceTemplateApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import { getMockedApiEServiceTemplate } from "pagopa-interop-commons-test/index.js";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getEserviceTemplates", () => {
  const mockApiEserviceTemplate1 = getMockedApiEServiceTemplate();
  const mockApiEserviceTemplate2 = getMockedApiEServiceTemplate();

  const mockParams: m2mGatewayApiV3.GetEServiceTemplatesQueryParams = {
    offset: 0,
    limit: 10,
    eserviceTemplateIds: [
      mockApiEserviceTemplate1.id,
      mockApiEserviceTemplate2.id,
    ],
    creatorIds: [],
  };

  const mockApiEserviceTemplates = [
    mockApiEserviceTemplate1,
    mockApiEserviceTemplate2,
  ];

  const mockEserviceTemplatesProcessResponse: WithMaybeMetadata<eserviceTemplateApi.EServiceTemplates> =
    {
      data: {
        results: mockApiEserviceTemplates,
        totalCount: mockApiEserviceTemplates.length,
      },
      metadata: undefined,
    };

  const mockGetEserviceTemplates = vi
    .fn()
    .mockResolvedValue(mockEserviceTemplatesProcessResponse);

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplates: mockGetEserviceTemplates,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEserviceTemplates.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const eserviceResponse1: m2mGatewayApiV3.EServiceTemplate = {
      id: mockApiEserviceTemplate1.id,
      name: mockApiEserviceTemplate1.name,
      description: mockApiEserviceTemplate1.description,
      technology: mockApiEserviceTemplate1.technology,
      mode: mockApiEserviceTemplate1.mode,
      intendedTarget: mockApiEserviceTemplate1.intendedTarget,
      creatorId: mockApiEserviceTemplate1.creatorId,
      isSignalHubEnabled: mockApiEserviceTemplate1.isSignalHubEnabled,
      personalData: mockApiEserviceTemplate1.personalData,
    };

    const eserviceResponse2: m2mGatewayApiV3.EServiceTemplate = {
      id: mockApiEserviceTemplate2.id,
      name: mockApiEserviceTemplate2.name,
      description: mockApiEserviceTemplate2.description,
      technology: mockApiEserviceTemplate2.technology,
      mode: mockApiEserviceTemplate2.mode,
      intendedTarget: mockApiEserviceTemplate2.intendedTarget,
      creatorId: mockApiEserviceTemplate2.creatorId,
      isSignalHubEnabled: mockApiEserviceTemplate2.isSignalHubEnabled,
      personalData: mockApiEserviceTemplate2.personalData,
    };

    const eserviceTemplatesResponse: m2mGatewayApiV3.EServiceTemplates = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: mockEserviceTemplatesProcessResponse.data.totalCount,
      },
      results: [eserviceResponse1, eserviceResponse2],
    };

    const result = await eserviceTemplateService.getEServiceTemplates(
      mockParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(eserviceTemplatesResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient.getEServiceTemplates,
      queries: {
        offset: mockParams.offset,
        limit: mockParams.limit,
        eserviceTemplatesIds: mockParams.eserviceTemplateIds,
        creatorsIds: mockParams.creatorIds,
        states: [],
      },
    });
  });
});
