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
import { toM2MGatewayEServiceTemplate } from "../../../src/api/eserviceTemplateApiConverter.js";

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
    const m2mTemplateResponse: m2mGatewayApi.EServiceTemplate =
      toM2MGatewayEServiceTemplate(mockApiTemplate.data);

    const result = await eserviceTemplateService.getEServiceTemplateById(
      unsafeBrandId(m2mTemplateResponse.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mTemplateResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: {
        templateId: m2mTemplateResponse.id,
      },
    });
  });
});
