import { describe, it, expect, vi, beforeEach } from "vitest";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  getMockedApiPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getPurposeTemplate", () => {
  const mockApiPurposeTemplateResponse = getMockWithMetadata(
    getMockedApiPurposeTemplate()
  );

  const mockGetPurposeTemplate = vi
    .fn()
    .mockResolvedValue(mockApiPurposeTemplateResponse);

  mockInteropBeClients.purposeTemplateProcessClient = {
    getPurposeTemplate: mockGetPurposeTemplate,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    mockGetPurposeTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result = await purposeTemplateService.getPurposeTemplate(
      unsafeBrandId(mockApiPurposeTemplateResponse.data.id),
      getMockM2MAdminAppContext()
    );

    expect(result).toEqual(mockApiPurposeTemplateResponse.data);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate,
      params: {
        id: mockApiPurposeTemplateResponse.data.id,
      },
    });
  });
});
