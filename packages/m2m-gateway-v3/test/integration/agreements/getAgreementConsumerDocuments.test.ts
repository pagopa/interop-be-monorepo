import { describe, it, expect, vi, beforeEach } from "vitest";
import { m2mGatewayApiV3, agreementApi } from "pagopa-interop-api-clients";
import { getMockedApiAgreementDocument } from "pagopa-interop-commons-test";
import { AgreementId, generateId } from "pagopa-interop-models";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  agreementService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";

describe("getAgreementConsumerDocuments", () => {
  const mockQueryParams: m2mGatewayApiV3.GetAgreementConsumerDocumentsQueryParams =
    {
      offset: 0,
      limit: 10,
    };

  const mockApiAgreementDoc1 = getMockedApiAgreementDocument();
  const mockApiAgreementDoc2 = getMockedApiAgreementDocument();

  const mockApiAgreementDocs = [mockApiAgreementDoc1, mockApiAgreementDoc2];

  const mockAgreementProcessResponse: WithMaybeMetadata<agreementApi.Documents> =
    {
      data: {
        results: mockApiAgreementDocs,
        totalCount: mockApiAgreementDocs.length,
      },
      metadata: undefined,
    };

  const mockGetAgreementConsumerDocuments = vi
    .fn()
    .mockResolvedValue(mockAgreementProcessResponse);

  mockInteropBeClients.agreementProcessClient = {
    getAgreementConsumerDocuments: mockGetAgreementConsumerDocuments,
  } as unknown as PagoPAInteropBeClients["agreementProcessClient"];

  beforeEach(() => {
    // Clear mock counters and call information before each test
    mockGetAgreementConsumerDocuments.mockClear();
  });

  it("Should succeed and perform API clients calls", async () => {
    const m2mDocument1: m2mGatewayApiV3.Document = {
      id: mockApiAgreementDoc1.id,
      name: mockApiAgreementDoc1.name,
      contentType: mockApiAgreementDoc1.contentType,
      createdAt: mockApiAgreementDoc1.createdAt,
      prettyName: mockApiAgreementDoc1.prettyName,
    };

    const m2mDocument2: m2mGatewayApiV3.Document = {
      id: mockApiAgreementDoc2.id,
      name: mockApiAgreementDoc2.name,
      contentType: mockApiAgreementDoc2.contentType,
      createdAt: mockApiAgreementDoc2.createdAt,
      prettyName: mockApiAgreementDoc2.prettyName,
    };

    const m2mAgreementsResponse: m2mGatewayApiV3.Documents = {
      pagination: {
        limit: mockQueryParams.limit,
        offset: mockQueryParams.offset,
        totalCount: mockAgreementProcessResponse.data.totalCount,
      },
      results: [m2mDocument1, m2mDocument2],
    };

    const agreementId = generateId<AgreementId>();
    const result = await agreementService.getAgreementConsumerDocuments(
      agreementId,
      mockQueryParams,
      getMockM2MAdminAppContext()
    );

    expect(result).toStrictEqual(m2mAgreementsResponse);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.agreementProcessClient
          .getAgreementConsumerDocuments,
      params: {
        agreementId,
      },
      queries: {
        offset: mockQueryParams.offset,
        limit: mockQueryParams.limit,
      },
    });
  });
});
