import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  pollingMaxRetriesExceeded,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  getMockedApiPurposeTemplate,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  expectApiClientGetToHaveBeenCalledWith,
  expectApiClientPostToHaveBeenCalledWith,
  mockDeletionPollingResponse,
  mockInteropBeClients,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { config } from "../../../src/config/config.js";

describe("deletePurposeTemplate", () => {
  const mockApiPurposeTemplate = getMockWithMetadata(
    getMockedApiPurposeTemplate()
  );

  const mockDeletePurposeTemplate = vi.fn();
  const mockGetPurposeTemplate = vi.fn(
    mockDeletionPollingResponse(mockApiPurposeTemplate, 2)
  );

  mockInteropBeClients.purposeTemplateProcessClient = {
    getPurposeTemplate: mockGetPurposeTemplate,
    deletePurposeTemplate: mockDeletePurposeTemplate,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    mockDeletePurposeTemplate.mockClear();
    mockGetPurposeTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    await purposeTemplateService.deletePurposeTemplate(
      unsafeBrandId(mockApiPurposeTemplate.data.id),
      getMockM2MAdminAppContext()
    );

    expectApiClientPostToHaveBeenCalledWith({
      mockPost:
        mockInteropBeClients.purposeTemplateProcessClient.deletePurposeTemplate,
      params: { id: mockApiPurposeTemplate.data.id },
    });
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate,
      params: { id: mockApiPurposeTemplate.data.id },
    });
    expect(
      mockInteropBeClients.purposeTemplateProcessClient.getPurposeTemplate
    ).toHaveBeenCalledTimes(2);
  });

  it("Should throw pollingMaxRetriesExceeded in case of polling max attempts", async () => {
    mockGetPurposeTemplate.mockImplementation(
      mockDeletionPollingResponse(
        mockApiPurposeTemplate,
        config.defaultPollingMaxRetries + 1
      )
    );

    await expect(
      purposeTemplateService.deletePurposeTemplate(
        unsafeBrandId(mockApiPurposeTemplate.data.id),
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      pollingMaxRetriesExceeded(
        config.defaultPollingMaxRetries,
        config.defaultPollingRetryDelay
      )
    );
    expect(mockGetPurposeTemplate).toHaveBeenCalledTimes(
      config.defaultPollingMaxRetries
    );
  });
});
