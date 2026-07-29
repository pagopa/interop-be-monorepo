import {
  attributeRegistryApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
import { getMockWithMetadata } from "pagopa-interop-commons-test";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toM2MGatewayApiVerifiedAttribute } from "../../../src/api/attributeApiConverter.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { eserviceTemplateVersionAttributeNotFound } from "../../../src/model/errors.js";
import {
  eserviceTemplateService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getEserviceTemplateVersionVerifiedAttributes", () => {
  const templateId = generateId();
  const versionId = generateId();

  const bulkAttribute1: attributeRegistryApi.Attribute = {
    id: generateId(),
    name: "Attribute Name 1",
    creationTime: new Date().toISOString(),
    description: "Description 1",
    kind: "VERIFIED",
  };
  const bulkAttribute2: attributeRegistryApi.Attribute = {
    id: generateId(),
    name: "Attribute Name 2",
    creationTime: new Date().toISOString(),
    description: "Description 2",
    kind: "VERIFIED",
  };

  const mockGetVersionVerifiedAttributes = vi.fn().mockResolvedValue(
    getMockWithMetadata({
      results: [
        { id: bulkAttribute1.id, groupIndex: 0 },
        { id: bulkAttribute2.id, groupIndex: 0 },
      ],
      totalCount: 2,
    })
  );

  const mockGetBulkedAttributes = vi.fn().mockResolvedValue({
    data: { results: [bulkAttribute1, bulkAttribute2], totalCount: 2 },
    metadata: {},
  });

  mockInteropBeClients.eserviceTemplateProcessClient = {
    getEServiceTemplateVersionVerifiedAttributes:
      mockGetVersionVerifiedAttributes,
  } as unknown as PagoPAInteropBeClients["eserviceTemplateProcessClient"];

  mockInteropBeClients.attributeProcessClient = {
    getBulkedAttributes: mockGetBulkedAttributes,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  const expectedResults = [
    {
      groupIndex: 0,
      attribute: toM2MGatewayApiVerifiedAttribute({
        attribute: bulkAttribute1,
        logger: genericLogger,
      }),
    },
    {
      groupIndex: 0,
      attribute: toM2MGatewayApiVerifiedAttribute({
        attribute: bulkAttribute2,
        logger: genericLogger,
      }),
    },
  ];

  beforeEach(() => {
    mockGetVersionVerifiedAttributes.mockClear();
    mockGetBulkedAttributes.mockClear();
  });

  it("Should delegate pagination to eservice-template-process and resolve the attributes", async () => {
    const result =
      await eserviceTemplateService.getEserviceTemplateVersionVerifiedAttributes(
        unsafeBrandId(templateId),
        unsafeBrandId(versionId),
        { limit: 10, offset: 0 },
        getMockM2MAdminAppContext()
      );

    const expected: m2mGatewayApiV3.EServiceTemplateVersionVerifiedAttributes =
      {
        results: expectedResults,
        pagination: { limit: 10, offset: 0, totalCount: 2 },
      };
    expect(result).toStrictEqual(expected);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet:
        mockInteropBeClients.eserviceTemplateProcessClient
          .getEServiceTemplateVersionVerifiedAttributes,
      params: { templateId, templateVersionId: versionId },
      queries: { offset: 0, limit: 10 },
    });
  });

  it("Should throw eserviceTemplateVersionAttributeNotFound when a reference cannot be resolved", async () => {
    const missingAttributeId = generateId();
    mockGetVersionVerifiedAttributes.mockResolvedValueOnce(
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
      eserviceTemplateService.getEserviceTemplateVersionVerifiedAttributes(
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
