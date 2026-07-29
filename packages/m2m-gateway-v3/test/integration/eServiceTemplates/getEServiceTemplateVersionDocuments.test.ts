import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import {
  getMockedApiEserviceDoc,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toM2MGatewayApiDocument } from "../../../src/api/eserviceTemplateApiConverter.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getEServiceTemplateVersionDocuments", () => {
  const templateId = generateId();
  const versionId = generateId();

  const mockDoc1 = getMockedApiEserviceDoc();
  const mockDoc2 = getMockedApiEserviceDoc();

  // Pagination (and version visibility) is now performed by
  // eservice-template-process.
  const mockProcessResponse = getMockWithMetadata({
    results: [mockDoc1, mockDoc2],
    totalCount: 5,
  });

  const mockGetEServiceTemplateVersionDocuments = vi
    .fn()
    .mockResolvedValue(mockProcessResponse);

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateVersionDocuments:
      mockGetEServiceTemplateVersionDocuments,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    mockGetEServiceTemplateVersionDocuments.mockClear();
  });

  it("Should delegate pagination to eservice-template-process and map the results", async () => {
    const expected: m2mGatewayApiV3.Documents = {
      results: [
        toM2MGatewayApiDocument(mockDoc1),
        toM2MGatewayApiDocument(mockDoc2),
      ],
      pagination: { offset: 0, limit: 10, totalCount: 5 },
    };

    const result =
      await eserviceTemplateService.getEServiceTemplateVersionDocuments(
        unsafeBrandId(templateId),
        unsafeBrandId(versionId),
        { offset: 0, limit: 10 },
        getMockM2MAdminAppContext()
      );

    expect(result).toStrictEqual(expected);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateVersionDocuments,
      params: { templateId, templateVersionId: versionId },
      queries: { offset: 0, limit: 10 },
    });
  });

  it("Should forward the pagination params to the process", async () => {
    await eserviceTemplateService.getEServiceTemplateVersionDocuments(
      unsafeBrandId(templateId),
      unsafeBrandId(versionId),
      { offset: 2, limit: 2 },
      getMockM2MAdminAppContext()
    );

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateVersionDocuments,
      params: { templateId, templateVersionId: versionId },
      queries: { offset: 2, limit: 2 },
    });
  });
});
