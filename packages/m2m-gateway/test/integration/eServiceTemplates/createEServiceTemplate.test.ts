import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import {
  getMockedApiEServiceTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("createEServiceTemplate", () => {
  const mockApiEserviceTemplate = getMockedApiEServiceTemplate();

  const mockApiEserviceTemplateWithVersion: m2mGatewayApi.VersionSeedForEServiceTemplateCreation =
  {
    voucherLifespan: 1000,
    description: "Version description",
    dailyCallsPerConsumer: 100,
    dailyCallsTotal: 1000,
    agreementApprovalPolicy: "AUTOMATIC",
  };

  const mockEserviceTemplateSeed: m2mGatewayApi.EServiceTemplateSeed = {
    name: mockApiEserviceTemplate.name,
    description: mockApiEserviceTemplate.description,
    version: {
      voucherLifespan: mockApiEserviceTemplateWithVersion.voucherLifespan,
      description: mockApiEserviceTemplateWithVersion.description,
      dailyCallsPerConsumer:
        mockApiEserviceTemplateWithVersion.dailyCallsPerConsumer,
      dailyCallsTotal: mockApiEserviceTemplateWithVersion.dailyCallsTotal,
      agreementApprovalPolicy:
        mockApiEserviceTemplateWithVersion.agreementApprovalPolicy,
    },
    technology: "REST",
    mode: "DELIVER",
    intendedTarget: "intendedTarget",
  };

  const mockEserviceTemplateProcessResponse = getMockWithMetadata(
    mockApiEserviceTemplate
  );

  const mockCreateEServiceTemplate = vi
    .fn()
    .mockResolvedValue(mockEserviceTemplateProcessResponse);

  const mockGetEserviceTemplate = vi.fn(
    mockPollingResponse(mockEserviceTemplateProcessResponse, 2)
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    createEServiceTemplate: mockCreateEServiceTemplate,
    getEServiceTemplateById: mockGetEserviceTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockCreateEServiceTemplate.mockClear();
    mockGetEserviceTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mEserviceResponse: m2mGatewayApi.EServiceTemplate = {
      id: mockEserviceTemplateProcessResponse.data.id,
      name: mockEserviceTemplateProcessResponse.data.name,
      description: mockEserviceTemplateProcessResponse.data.description,
      technology: mockEserviceTemplateProcessResponse.data.technology,
      mode: mockEserviceTemplateProcessResponse.data.mode,
      intendedTarget: mockEserviceTemplateProcessResponse.data.intendedTarget,
      creatorId: mockEserviceTemplateProcessResponse.data.creatorId,
      isSignalHubEnabled:
        mockEserviceTemplateProcessResponse.data.isSignalHubEnabled,
      personalData: mockEserviceTemplateProcessResponse.data.personalData,
    };

    const result = await eserviceTemplateService.createEServiceTemplate(
      mockEserviceTemplateSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mEserviceResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .createEServiceTemplate,
      body: mockEserviceTemplateSeed,
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: mockEserviceTemplateProcessResponse.data.id },
    });
    expect(
      mockInteropBeClients.eserviceTemplateProcessClient.getEServiceTemplateById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the attribute returned by the creation POST call has no metadata", async () => {
    mockCreateEServiceTemplate.mockResolvedValueOnce({
      ...mockEserviceTemplateProcessResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.createEServiceTemplate(
        mockEserviceTemplateSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the attribute returned by the polling GET call has no metadata", async () => {
    mockGetEserviceTemplate.mockResolvedValueOnce({
      ...mockEserviceTemplateProcessResponse,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.createEServiceTemplate(
        mockEserviceTemplateSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEserviceTemplate.mockImplementation(
      mockPollingResponse(
        mockEserviceTemplateProcessResponse,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceTemplateService.createEServiceTemplate(
        mockEserviceTemplateSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEserviceTemplate).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
