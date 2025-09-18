import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApi, eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  getMockedApiEserviceDoc,
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { unsafeBrandId } from "pagopa-interop-models";
import {
  eserviceTemplateService,
  mockInteropBeClients,
  mockPollingResponse,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { toM2MGatewayApiDocument } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("getEServiceDescriptorDocuments", () => {
  type EServiceTemplateDocs = {
    results: eserviceTemplateApi.EServiceDoc[];
    totalCount: number;
  };

  const mockQueryParams: m2mGatewayApi.GetEServiceTemplateVersionDocumentsQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  const mockApiEServiceTemplateDoc1 = getMockedApiEserviceDoc();
  const mockApiEServiceTemplateDoc2 = getMockedApiEserviceDoc();

  const mockApiEServiceTemplateDocs = [
    mockApiEServiceTemplateDoc1,
    mockApiEServiceTemplateDoc2,
  ];

  const mockEServiceProcessResponse: WithMaybeMetadata<EServiceTemplateDocs> = {
    data: {
      results: mockApiEServiceTemplateDocs,
      totalCount: mockApiEServiceTemplateDocs.length,
    },
    metadata: undefined,
  };

  const document1: eserviceTemplateApi.EServiceDoc = {
    id: mockApiEServiceTemplateDoc1.id,
    name: mockApiEServiceTemplateDoc1.name,
    contentType: mockApiEServiceTemplateDoc1.contentType,
    uploadDate: mockApiEServiceTemplateDoc1.uploadDate,
    prettyName: mockApiEServiceTemplateDoc1.prettyName,
    path: mockApiEServiceTemplateDoc1.path,
    checksum: mockApiEServiceTemplateDoc1.checksum,
  };

  const document2: eserviceTemplateApi.EServiceDoc = {
    id: mockApiEServiceTemplateDoc2.id,
    name: mockApiEServiceTemplateDoc2.name,
    contentType: mockApiEServiceTemplateDoc2.contentType,
    uploadDate: mockApiEServiceTemplateDoc2.uploadDate,
    prettyName: mockApiEServiceTemplateDoc2.prettyName,
    path: mockApiEServiceTemplateDoc2.path,
    checksum: mockApiEServiceTemplateDoc2.checksum,
  };

  const m2mDocument1 = toM2MGatewayApiDocument(document1);
  const m2mDocument2 = toM2MGatewayApiDocument(document2);

  const m2mDocumentsResponse: m2mGatewayApi.Documents = {
    pagination: {
      limit: mockQueryParams.limit,
      offset: mockQueryParams.offset,
      totalCount: mockEServiceProcessResponse.data.totalCount,
    },
    results: [m2mDocument1, m2mDocument2],
  };

  const eserviceTemplate: eserviceTemplateApi.EServiceTemplate = {
    ...getMockedApiEServiceTemplate(),
    versions: [
      {
        ...getMockedApiEserviceTemplateVersion(),
        docs: [document1, document2],
      },
    ],
  };

  const mockEServiceTemplateProcessResponse =
    getMockWithMetadata(eserviceTemplate);

  const mockGetEServiceTemplate = vi.fn(
    mockPollingResponse(mockEServiceTemplateProcessResponse, 1)
  );

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateById: mockGetEServiceTemplate,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEServiceTemplate.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const result =
      await eserviceTemplateService.getEServiceTemplateVersionDocuments(
        unsafeBrandId(eserviceTemplate.id),
        unsafeBrandId(eserviceTemplate.versions[0].id),
        mockQueryParams,
        getMockM2MAdminAppContext()
      );

    expect(result).toEqual(m2mDocumentsResponse);
  });
});
