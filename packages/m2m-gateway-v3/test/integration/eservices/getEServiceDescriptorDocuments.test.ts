import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3, catalogApi } from "pagopa-interop-api-clients";
import { getMockedApiEserviceDoc } from "pagopa-interop-commons-test";
import { DescriptorId, EServiceId, generateId } from "pagopa-interop-models";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  eserviceService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getEServiceDescriptorDocuments", () => {
  const mockQueryParams: m2mGatewayApiV3.GetEServiceDescriptorDocumentsQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  const mockApiEServiceDoc1 = getMockedApiEserviceDoc();
  const mockApiEServiceDoc2 = getMockedApiEserviceDoc();

  const mockApiEServiceDocs = [mockApiEServiceDoc1, mockApiEServiceDoc2];

  const mockEServiceProcessResponse: WithMaybeMetadata<catalogApi.EServiceDocs> =
    {
      data: {
        results: mockApiEServiceDocs,
        totalCount: mockApiEServiceDocs.length,
      },
      metadata: undefined,
    };

  const mockGetEServiceDescriptorDocuments = vi
    .fn()
    .mockResolvedValue(mockEServiceProcessResponse);

  mockInteropBeClients.catalogProcessClient = {
    getEServiceDocuments: mockGetEServiceDescriptorDocuments,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetEServiceDescriptorDocuments.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mDocument1: m2mGatewayApiV3.Document = {
      id: mockApiEServiceDoc1.id,
      name: mockApiEServiceDoc1.name,
      contentType: mockApiEServiceDoc1.contentType,
      createdAt: mockApiEServiceDoc1.uploadDate,
      prettyName: mockApiEServiceDoc1.prettyName,
    };

    const m2mDocument2: m2mGatewayApiV3.Document = {
      id: mockApiEServiceDoc2.id,
      name: mockApiEServiceDoc2.name,
      contentType: mockApiEServiceDoc2.contentType,
      createdAt: mockApiEServiceDoc2.uploadDate,
      prettyName: mockApiEServiceDoc2.prettyName,
    };

    const m2mDocumentsResponse: m2mGatewayApiV3.Documents = {
      pagination: {
        limit: mockQueryParams.limit,
        offset: mockQueryParams.offset,
        totalCount: mockEServiceProcessResponse.data.totalCount,
      },
      results: [m2mDocument1, m2mDocument2],
    };

    const eserviceId = generateId<EServiceId>();
    const descriptorId = generateId<DescriptorId>();
    const result = await eserviceService.getEServiceDescriptorDocuments(
      eserviceId,
      descriptorId,
      mockQueryParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mDocumentsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockInteropBeClients.catalogProcessClient.getEServiceDocuments,
      params: {
        eServiceId: eserviceId,
        descriptorId,
      },
      queries: {
        offset: mockQueryParams.offset,
        limit: mockQueryParams.limit,
      },
    });
  });
});
