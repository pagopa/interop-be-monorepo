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
} from "../../mockUtils.js";

describe("getEserviceTemplate", () => {
  const mockApiTemplate = getMockedApiEServiceTemplate();

  const mockGetTemplate = vi.fn().mockResolvedValue(mockApiTemplate);

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockGetTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const expectedM2MTemplate: m2mGatewayApi.EServiceTemplate = {
      creatorId: mockApiTemplate.data.creatorId,
      description: mockApiTemplate.data.description,
      id: mockApiTemplate.data.id,
      intendedTarget: mockApiTemplate.data.intendedTarget,
      mode: mockApiTemplate.data.mode,
      name: mockApiTemplate.data.name,
      technology: mockApiTemplate.data.technology,
      isSignalHubEnabled: mockApiTemplate.data.isSignalHubEnabled,
    };

    const result = await eserviceTemplateService.getEServiceTemplateById(
      unsafeBrandId(expectedM2MTemplate.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedM2MTemplate);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: {
        templateId: expectedM2MTemplate.id,
      },
    });
  });
});
