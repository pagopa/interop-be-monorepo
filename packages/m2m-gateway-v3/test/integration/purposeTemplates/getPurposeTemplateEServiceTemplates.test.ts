import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  m2mGatewayApiV3,
  purposeTemplateApi,
} from "pagopa-interop-api-clients";
import { getMockedApiEServiceTemplate } from "pagopa-interop-commons-test";
import { generateId, PurposeTemplateId } from "pagopa-interop-models";
import {
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
  purposeTemplateService,
} from "../../integrationUtils.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";
import { WithMaybeMetadata } from "../../../src/clients/zodiosWithMetadataPatch.js";
import { toM2MGatewayEServiceTemplate } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("getPurposeTemplateEServiceTemplates", () => {
  const mockParams: m2mGatewayApiV3.GetPurposeTemplateEServiceTemplatesQueryParams =
    {
      offset: 0,
      limit: 10,
      creatorIds: [],
    };

  const mockApiEServiceTemplate1 = getMockedApiEServiceTemplate();
  const mockApiEServiceTemplate2 = getMockedApiEServiceTemplate();
  const mockApiEServiceTemplates = [
    mockApiEServiceTemplate1,
    mockApiEServiceTemplate2,
  ];

  const mockGetEServiceTemplates = vi.fn(
    ({ queries: { eserviceTemplatesIds } }) =>
      Promise.resolve({
        data: {
          results: mockApiEServiceTemplates.filter((t) =>
            eserviceTemplatesIds.includes(t.id)
          ),
        },
      })
  );
  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplates: mockGetEServiceTemplates,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  const mockApiPurposeTemplateEServiceTemplateLink1: purposeTemplateApi.EServiceTemplateVersionPurposeTemplate =
    {
      purposeTemplateId: generateId(),
      eserviceTemplateId: mockApiEServiceTemplate1.id,
      eserviceTemplateVersionId: generateId(),
      createdAt: new Date().toISOString(),
    };
  const mockApiPurposeTemplateEServiceTemplateLink2: purposeTemplateApi.EServiceTemplateVersionPurposeTemplate =
    {
      purposeTemplateId: generateId(),
      eserviceTemplateId: mockApiEServiceTemplate2.id,
      eserviceTemplateVersionId: generateId(),
      createdAt: new Date().toISOString(),
    };
  const mockApiPurposeTemplateEServiceTemplateLinks = [
    mockApiPurposeTemplateEServiceTemplateLink1,
    mockApiPurposeTemplateEServiceTemplateLink2,
  ];

  const mockPurposeTemplateEServiceTemplatesProcessResponse: WithMaybeMetadata<purposeTemplateApi.EServiceTemplateVersionsPurposeTemplate> =
    {
      data: {
        results: mockApiPurposeTemplateEServiceTemplateLinks,
        totalCount: mockApiPurposeTemplateEServiceTemplateLinks.length,
      },
      metadata: undefined,
    };

  const mockGetPurposeTemplateEServiceTemplates = vi
    .fn()
    .mockResolvedValue(mockPurposeTemplateEServiceTemplatesProcessResponse);

  mockInteropBeClients.purposeTemplateProcessClient = {
    getPurposeTemplateEServiceTemplates:
      mockGetPurposeTemplateEServiceTemplates,
  } as unknown as PagoPAInteropBeClients["purposeTemplateProcessClient"];

  beforeEach(() => {
    mockGetPurposeTemplateEServiceTemplates.mockClear();
    mockGetEServiceTemplates.mockClear();
  });

  it("Should succeed and chain process retrieval + enrichment client calls", async () => {
    const purposeTemplateId = generateId<PurposeTemplateId>();
    const expected: m2mGatewayApiV3.EServiceTemplates = {
      pagination: {
        limit: mockParams.limit,
        offset: mockParams.offset,
        totalCount:
          mockPurposeTemplateEServiceTemplatesProcessResponse.data.totalCount,
      },
      results: [mockApiEServiceTemplate1, mockApiEServiceTemplate2].map(
        toM2MGatewayEServiceTemplate
      ),
    };

    const result =
      await purposeTemplateService.getPurposeTemplateEServiceTemplates(
        purposeTemplateId,
        mockParams,
        getMockM2MAdminAppContext()
      );

    expect(result).toStrictEqual(expected);
    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.purposeTemplateProcessClient
          .getPurposeTemplateEServiceTemplates,
      params: { id: purposeTemplateId },
      queries: {
        offset: mockParams.offset,
        limit: mockParams.limit,
        eserviceTemplateName: mockParams.eserviceTemplateName,
        creatorIds: [],
      } satisfies m2mGatewayApiV3.GetPurposeTemplateEServiceTemplatesQueryParams,
    });
    expect(mockGetEServiceTemplates).toHaveBeenCalledTimes(1);
    expect(mockGetEServiceTemplates).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: expect.objectContaining({
          eserviceTemplatesIds: [
            mockApiEServiceTemplate1.id,
            mockApiEServiceTemplate2.id,
          ],
          offset: 0,
          limit: mockParams.limit,
        }),
      })
    );
  });

  it("Should silently drop links whose template is not returned by enrichment (locked semantics)", async () => {
    const purposeTemplateId = generateId<PurposeTemplateId>();
    // Process returns 2 links but enrichment finds only 1: the M2M response has
    // 1 result while pagination.totalCount stays at 2 (no cross-validation).
    mockGetEServiceTemplates.mockResolvedValueOnce({
      data: {
        results: [mockApiEServiceTemplate1],
      },
    });

    const result =
      await purposeTemplateService.getPurposeTemplateEServiceTemplates(
        purposeTemplateId,
        mockParams,
        getMockM2MAdminAppContext()
      );

    expect(result.results).toStrictEqual([
      toM2MGatewayEServiceTemplate(mockApiEServiceTemplate1),
    ]);
    expect(result.pagination.totalCount).toBe(2);
    expect(result.pagination.totalCount).not.toBe(result.results.length);
  });

  it("Should always invoke the enrichment client even when there are no links (locked: no empty short-circuit)", async () => {
    const purposeTemplateId = generateId<PurposeTemplateId>();
    mockGetPurposeTemplateEServiceTemplates.mockResolvedValueOnce({
      data: { results: [], totalCount: 0 },
      metadata: undefined,
    });
    mockGetEServiceTemplates.mockResolvedValueOnce({
      data: { results: [] },
    });

    const result =
      await purposeTemplateService.getPurposeTemplateEServiceTemplates(
        purposeTemplateId,
        mockParams,
        getMockM2MAdminAppContext()
      );

    expect(result).toStrictEqual({
      pagination: {
        offset: mockParams.offset,
        limit: mockParams.limit,
        totalCount: 0,
      },
      results: [],
    });
    expect(mockGetEServiceTemplates).toHaveBeenCalledTimes(1);
    expect(mockGetEServiceTemplates).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: expect.objectContaining({
          eserviceTemplatesIds: [],
        }),
      })
    );
  });
});
