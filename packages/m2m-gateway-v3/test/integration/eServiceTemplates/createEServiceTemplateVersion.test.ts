import { describe, it, expect, vi, beforeEach } from "vitest";
import { eserviceTemplateApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  EServiceTemplateId,
  pollingMaxRetriesExceeded,
} from "pagopa-interop-models";
import {
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
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

describe("createEServiceTemplateVersion", () => {
  const versionSeed: m2mGatewayApiV3.EServiceTemplateVersionSeed = {
    description: "Test Version",
    voucherLifespan: 100,
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 10,
    agreementApprovalPolicy: "AUTOMATIC",
  };

  const mockVersion = getMockedApiEserviceTemplateVersion();
  const mockEServiceTemplate = getMockedApiEServiceTemplate({
    versions: [mockVersion],
  });

  const mockCreateResponseData: eserviceTemplateApi.CreatedEServiceTemplateVersion =
  {
    eserviceTemplate: mockEServiceTemplate,
    createdEServiceTemplateVersionId: mockEServiceTemplate.versions[0].id,
  };
  const mockCreateVersion = vi.fn().mockResolvedValue({
    data: mockCreateResponseData,
    metadata: { version: 0 },
  });
  const mockGetEServiceTemplate = vi.fn(
    mockPollingResponse(getMockWithMetadata(mockEServiceTemplate), 2)
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    createEServiceTemplateVersion: mockCreateVersion,
    getEServiceTemplateById: mockGetEServiceTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockCreateVersion.mockClear();
    mockGetEServiceTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mEServiceTemplateVersionResponse: m2mGatewayApiV3.EServiceTemplateVersion =
    {
      id: mockVersion.id,
      description: mockVersion.description,
      state: mockVersion.state,
      version: mockVersion.version,
      voucherLifespan: mockVersion.voucherLifespan,
      dailyCallsPerConsumer: mockVersion.dailyCallsPerConsumer,
      dailyCallsTotal: mockVersion.dailyCallsTotal,
      agreementApprovalPolicy: mockVersion.agreementApprovalPolicy,
      deprecatedAt: mockVersion.deprecatedAt,
      publishedAt: mockVersion.publishedAt,
      suspendedAt: mockVersion.suspendedAt,
    };

    const result = await eserviceTemplateService.createEServiceTemplateVersion(
      mockEServiceTemplate.id as EServiceTemplateId,
      versionSeed,
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(m2mEServiceTemplateVersionResponse);
    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.eserviceTemplateProcessClient
          .createEServiceTemplateVersion,
      params: { templateId: mockEServiceTemplate.id },
      body: {
        ...versionSeed,
        attributes: {
          certified: [],
          declared: [],
          verified: [],
        },
        docs: [],
      },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: { templateId: mockEServiceTemplate.id },
    });
    expect(
      mockInteropBeClients.eserviceTemplateProcessClient.getEServiceTemplateById
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw missingMetadata in case the payload returned by the creation POST call has no metadata", async () => {
    mockCreateVersion.mockResolvedValueOnce({
      data: mockCreateResponseData,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        mockEServiceTemplate.id as EServiceTemplateId,
        versionSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });

  it("Should throw missingMetadata in case the payload returned by the polling GET call has no metadata", async () => {
    mockGetEServiceTemplate.mockResolvedValueOnce({
      data: mockEServiceTemplate,
      metadata: undefined,
    });

    await expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        mockEServiceTemplate.id as EServiceTemplateId,
        versionSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(missingMetadata());
  });
  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetEServiceTemplate.mockImplementation(
      mockPollingResponse(
        getMockWithMetadata(mockEServiceTemplate),
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      eserviceTemplateService.createEServiceTemplateVersion(
        mockEServiceTemplate.id as EServiceTemplateId,
        versionSeed,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetEServiceTemplate).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
