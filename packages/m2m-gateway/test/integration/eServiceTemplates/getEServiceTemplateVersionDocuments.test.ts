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

describe("getEServiceTemplateVersionDocuments", () => {
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
  const mockApiEServiceTemplateDoc3 = getMockedApiEserviceDoc();
  const mockApiEServiceTemplateDoc4 = getMockedApiEserviceDoc();
  const mockApiEServiceTemplateDoc5 = getMockedApiEserviceDoc();

  const mockApiEServiceTemplateDocs = [
    mockApiEServiceTemplateDoc1,
    mockApiEServiceTemplateDoc2,
    mockApiEServiceTemplateDoc3,
    mockApiEServiceTemplateDoc4,
    mockApiEServiceTemplateDoc5,
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

  const document3: eserviceTemplateApi.EServiceDoc = {
    id: mockApiEServiceTemplateDoc3.id,
    name: mockApiEServiceTemplateDoc3.name,
    contentType: mockApiEServiceTemplateDoc3.contentType,
    uploadDate: mockApiEServiceTemplateDoc3.uploadDate,
    prettyName: mockApiEServiceTemplateDoc3.prettyName,
    path: mockApiEServiceTemplateDoc3.path,
    checksum: mockApiEServiceTemplateDoc3.checksum,
  };

  const document4: eserviceTemplateApi.EServiceDoc = {
    id: mockApiEServiceTemplateDoc4.id,
    name: mockApiEServiceTemplateDoc4.name,
    contentType: mockApiEServiceTemplateDoc4.contentType,
    uploadDate: mockApiEServiceTemplateDoc4.uploadDate,
    prettyName: mockApiEServiceTemplateDoc4.prettyName,
    path: mockApiEServiceTemplateDoc4.path,
    checksum: mockApiEServiceTemplateDoc4.checksum,
  };

  const document5: eserviceTemplateApi.EServiceDoc = {
    id: mockApiEServiceTemplateDoc5.id,
    name: mockApiEServiceTemplateDoc5.name,
    contentType: mockApiEServiceTemplateDoc5.contentType,
    uploadDate: mockApiEServiceTemplateDoc5.uploadDate,
    prettyName: mockApiEServiceTemplateDoc5.prettyName,
    path: mockApiEServiceTemplateDoc5.path,
    checksum: mockApiEServiceTemplateDoc5.checksum,
  };

  const m2mDocument1 = toM2MGatewayApiDocument(document1);
  const m2mDocument2 = toM2MGatewayApiDocument(document2);
  const m2mDocument3 = toM2MGatewayApiDocument(document3);
  const m2mDocument4 = toM2MGatewayApiDocument(document4);
  const m2mDocument5 = toM2MGatewayApiDocument(document5);

  const m2mDocumentsResponse: m2mGatewayApi.Documents = {
    pagination: {
      limit: mockQueryParams.limit,
      offset: mockQueryParams.offset,
      totalCount: mockEServiceProcessResponse.data.totalCount,
    },
    results: [
      m2mDocument1,
      m2mDocument2,
      m2mDocument3,
      m2mDocument4,
      m2mDocument5,
    ],
  };

  const eserviceTemplate: eserviceTemplateApi.EServiceTemplate = {
    ...getMockedApiEServiceTemplate(),
    versions: [
      {
        ...getMockedApiEserviceTemplateVersion(),
        docs: [document1, document2, document3, document4, document5],
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

    expect(result).toStrictEqual(m2mDocumentsResponse);
  });

  it("Should apply filters (offset, limit)", async () => {
    const response1: m2mGatewayApi.Documents = {
      pagination: {
        offset: 0,
        limit: 2,
        totalCount: eserviceTemplate.versions[0].docs.length,
      },
      results: [m2mDocument1, m2mDocument2],
    };

    const result =
      await eserviceTemplateService.getEServiceTemplateVersionDocuments(
        unsafeBrandId(eserviceTemplate.id),
        unsafeBrandId(eserviceTemplate.versions[0].id),
        {
          offset: 0,
          limit: 2,
        },
        getMockM2MAdminAppContext()
      );

    expect(result).toStrictEqual(response1);

    const response2: m2mGatewayApi.Documents = {
      pagination: {
        offset: 2,
        limit: 2,
        totalCount: eserviceTemplate.versions[0].docs.length,
      },
      results: [m2mDocument3, m2mDocument4],
    };

    const result2 =
      await eserviceTemplateService.getEServiceTemplateVersionDocuments(
        unsafeBrandId(eserviceTemplate.id),
        unsafeBrandId(eserviceTemplate.versions[0].id),
        {
          offset: 2,
          limit: 2,
        },
        getMockM2MAdminAppContext()
      );

    expect(result2).toStrictEqual(response2);

    const response3: m2mGatewayApi.Documents = {
      pagination: {
        offset: 4,
        limit: 2,
        totalCount: eserviceTemplate.versions[0].docs.length,
      },
      results: [m2mDocument5],
    };

    const result3 =
      await eserviceTemplateService.getEServiceTemplateVersionDocuments(
        unsafeBrandId(eserviceTemplate.id),
        unsafeBrandId(eserviceTemplate.versions[0].id),
        {
          offset: 4,
          limit: 2,
        },
        getMockM2MAdminAppContext()
      );

    expect(result3).toStrictEqual(response3);
  });
});
