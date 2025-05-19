import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  getMockM2MAdminAppContext,
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
} from "../../mockUtils.js";
import { toM2MGatewayEServiceTemplateVersion } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("getEServiceTemplateVersions", () => {
  const mockParams: m2mGatewayApi.GetEServiceTemplateVersionsQueryParams = {
    state: undefined,
    offset: 0,
    limit: 10,
  };

  const mockApiTemplateVersion1 = getMockedApiEserviceTemplateVersion({
    state: "DRAFT",
  });
  const mockApiTemplateVersion2 = getMockedApiEserviceTemplateVersion({
    state: "DEPRECATED",
  });

  const mockApiTemplate = getMockedApiEServiceTemplate({
    versions: [mockApiTemplateVersion1, mockApiTemplateVersion2],
  });

  const mockM2MVersion1 = toM2MGatewayEServiceTemplateVersion(
    mockApiTemplateVersion1
  );
  const mockM2MVersion2 = toM2MGatewayEServiceTemplateVersion(
    mockApiTemplateVersion2
  );

  const mockGetTemplate = vi.fn().mockResolvedValue(mockApiTemplate);

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockGetTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mTemplateResponse: m2mGatewayApi.EServiceTemplateVersions = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: 2,
      },
      results: [mockM2MVersion1, mockM2MVersion2],
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

  it("Should correctly apply pagination from the retrieved template", async () => {
    const m2mTemplateResponse: m2mGatewayApi.EServiceTemplateVersions = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount: 1,
      },
      results: [mockM2MVersion2],
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
