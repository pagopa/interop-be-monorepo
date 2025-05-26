import { describe, it, expect, vi, beforeEach } from "vitest";
import { eserviceTemplateApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import { getMockM2MAdminAppContext } from "pagopa-interop-commons-test/src/testUtils.js";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockedApiEServiceTemplate } from "../../mockUtils.js";

describe("getEserviceTemplate", () => {
  const mockApiTemplate = getMockedApiEServiceTemplate();

  const mockGetTemplate = vi.fn().mockResolvedValue(mockApiTemplate);

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockGetTemplate.mockClear();
  });

  const testToM2MEServiceTemplateVersion = (
    version: eserviceTemplateApi.EServiceTemplateVersion
  ): m2mGatewayApi.EServiceTemplateVersion => ({
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
      versions: mockApiTemplate.data.versions.map(
        testToM2MEServiceTemplateVersion
      ),
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
