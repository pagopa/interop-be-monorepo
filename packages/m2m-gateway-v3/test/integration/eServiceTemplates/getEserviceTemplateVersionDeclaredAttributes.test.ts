import {
  attributeRegistryApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
import { getMockWithMetadata } from "pagopa-interop-commons-test";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toM2MGatewayApiDeclaredAttribute } from "../../../src/api/attributeApiConverter.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { eserviceTemplateVersionAttributeNotFound } from "../../../src/model/errors.js";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getEserviceTemplateVersionDeclaredAttributes", () => {
  const templateId = generateId();
  const versionId = generateId();

  const bulkAttribute1: attributeRegistryApi.Attribute = {
    id: generateId(),
    name: "Attribute Name 1",
    creationTime: new Date().toISOString(),
    description: "Description 1",
    kind: "DECLARED",
  };
  const bulkAttribute2: attributeRegistryApi.Attribute = {
    id: generateId(),
    name: "Attribute Name 2",
    creationTime: new Date().toISOString(),
    description: "Description 2",
    kind: "DECLARED",
  };

  const mockGetVersionDeclaredAttributes = vi.fn().mockResolvedValue(
    getMockWithMetadata({
      results: [
        { id: bulkAttribute1.id, groupIndex: 0 },
        { id: bulkAttribute2.id, groupIndex: 1 },
      ],
      totalCount: 2,
    })
  );

  const mockGetBulkedAttributes = vi.fn().mockResolvedValue({
    data: { results: [bulkAttribute1, bulkAttribute2], totalCount: 2 },
    metadata: {},
  });

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateVersionDeclaredAttributes:
      mockGetVersionDeclaredAttributes,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  mockInteropBeClients.attributeProcessClient = {
    getBulkedAttributes: mockGetBulkedAttributes,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  const expectedResults = [
    {
      groupIndex: 0,
      attribute: toM2MGatewayApiDeclaredAttribute({
        attribute: bulkAttribute1,
        logger: genericLogger,
      }),
    },
    {
      groupIndex: 1,
      attribute: toM2MGatewayApiDeclaredAttribute({
        attribute: bulkAttribute2,
        logger: genericLogger,
      }),
    },
  ];

  beforeEach(() => {
    mockGetVersionDeclaredAttributes.mockClear();
    mockGetBulkedAttributes.mockClear();
  });

  it("Should delegate pagination to eservice-template-process and resolve the attributes", async () => {
    const result =
      await eserviceTemplateService.getEserviceTemplateVersionDeclaredAttributes(
        unsafeBrandId(templateId),
        unsafeBrandId(versionId),
        { limit: 10, offset: 0 },
        getMockM2MAdminAppContext()
      );

    const expected: m2mGatewayApiV3.EServiceTemplateVersionDeclaredAttributes =
      {
        results: expectedResults,
        pagination: { limit: 10, offset: 0, totalCount: 2 },
      };
    expect(result).toStrictEqual(expected);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateVersionDeclaredAttributes,
      params: { templateId, templateVersionId: versionId },
      queries: { offset: 0, limit: 10 },
    });
  });

  it("Should throw eserviceTemplateVersionAttributeNotFound when a reference cannot be resolved", async () => {
    const missingAttributeId = generateId();
    mockGetVersionDeclaredAttributes.mockResolvedValueOnce(
      getMockWithMetadata({
        results: [{ id: missingAttributeId, groupIndex: 0 }],
        totalCount: 1,
      })
    );
    mockGetBulkedAttributes.mockResolvedValueOnce({
      data: { results: [], totalCount: 0 },
      metadata: {},
    });

    await expect(
      eserviceTemplateService.getEserviceTemplateVersionDeclaredAttributes(
        unsafeBrandId(templateId),
        unsafeBrandId(versionId),
        { limit: 10, offset: 0 },
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceTemplateVersionAttributeNotFound(unsafeBrandId(versionId))
    );
  });
});
