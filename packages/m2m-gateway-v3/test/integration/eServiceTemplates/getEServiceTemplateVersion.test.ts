import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateVersionId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  eserviceTemplateApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
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
import { eserviceTemplateVersionNotFound } from "../../../src/model/errors.js";

describe("getEServiceTemplateVersion", () => {
  const mockApiTemplateVersion1 = getMockedApiEserviceTemplateVersion({
    state: eserviceTemplateApi.EServiceTemplateVersionState.Enum.DRAFT,
  });

  const mockApiTemplateVersion2 = getMockedApiEserviceTemplateVersion({
    state: eserviceTemplateApi.EServiceTemplateVersionState.Enum.DEPRECATED,
  });

  const mockApiTemplate = getMockWithMetadata(
    getMockedApiEServiceTemplate({
      versions: [mockApiTemplateVersion1, mockApiTemplateVersion2],
    })
  );

  const mockGetTemplate = vi.fn().mockResolvedValue(mockApiTemplate);

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockGetTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const expectedM2MTemplateVersion: m2mGatewayApiV3.EServiceTemplateVersion =
      {
        id: mockApiTemplateVersion1.id,
        state: mockApiTemplateVersion1.state,
        version: mockApiTemplateVersion1.version,
        voucherLifespan: mockApiTemplateVersion1.voucherLifespan,
        agreementApprovalPolicy:
          mockApiTemplateVersion1.agreementApprovalPolicy,
        dailyCallsPerConsumer: mockApiTemplateVersion1.dailyCallsPerConsumer,
        dailyCallsTotal: mockApiTemplateVersion1.dailyCallsTotal,
        deprecatedAt: mockApiTemplateVersion1.deprecatedAt,
        description: mockApiTemplateVersion1.description,
        publishedAt: mockApiTemplateVersion1.publishedAt,
        suspendedAt: mockApiTemplateVersion1.suspendedAt,
      };

    const result = await eserviceTemplateService.getEServiceTemplateVersion(
      unsafeBrandId(mockApiTemplate.data.id),
      unsafeBrandId(mockApiTemplateVersion1.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(expectedM2MTemplateVersion);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: {
        templateId: mockApiTemplate.data.id,
      },
    });
  });

  it("Should throw a eserviceTemplateVersionNotFound error if version is not in template", async () => {
    const randomVersionId = generateId<EServiceTemplateVersionId>();

    await expect(
      eserviceTemplateService.getEServiceTemplateVersion(
        unsafeBrandId(mockApiTemplate.data.id),
        randomVersionId,
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrow(
      eserviceTemplateVersionNotFound(
        unsafeBrandId(mockApiTemplate.data.id),
        randomVersionId
      )
    );
  });
});
