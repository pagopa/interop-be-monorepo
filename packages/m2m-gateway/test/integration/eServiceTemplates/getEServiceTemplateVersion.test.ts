import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EServiceTemplateVersionId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
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
import { eserviceTemplateVersionNotFound } from "../../../src/model/errors.js";
import { toM2MGatewayEServiceTemplateVersion } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("getEServiceTemplateVersion", () => {
  const mockApiTemplateVersion1 = getMockedApiEserviceTemplateVersion({
    state: "DRAFT",
  });
  const mockApiTemplateVersion2 = getMockedApiEserviceTemplateVersion({
    state: "DEPRECATED",
  });

  const mockApiTemplate = getMockedApiEServiceTemplate({
    versions: [mockApiTemplateVersion1, mockApiTemplateVersion2],
  });

  const mockGetTemplate = vi.fn().mockResolvedValue(mockApiTemplate);

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockGetTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const mockM2MVersionResponse = toM2MGatewayEServiceTemplateVersion(
      mockApiTemplateVersion1
    );

    const result = await eserviceTemplateService.getEServiceTemplateVersion(
      unsafeBrandId(mockApiTemplate.data.id),
      unsafeBrandId(mockApiTemplateVersion1.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(mockM2MVersionResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateById,
      params: {
        templateId: mockApiTemplate.data.id,
      },
    });
  });

  it("Should throw a eServiceTemplateVersionNotFound error if version is not in template", async () => {
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
