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
import { eserviceDescriptorAttributeNotFound } from "../../../src/model/errors.js";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getEserviceDescriptorDeclaredAttributes", () => {
  const eserviceId = generateId();
  const descriptorId = generateId();

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

  const mockGetDeclaredAttributes = vi.fn().mockResolvedValue(
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

  mockInteropBeClients.catalogProcessClient = {
    getEServiceDescriptorDeclaredAttributes: mockGetDeclaredAttributes,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

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
    mockGetDeclaredAttributes.mockClear();
    mockGetBulkedAttributes.mockClear();
  });

  it("Should delegate pagination to catalog-process and resolve the attributes", async () => {
    const result =
      await eserviceService.getEserviceDescriptorDeclaredAttributes(
        unsafeBrandId(eserviceId),
        unsafeBrandId(descriptorId),
        { limit: 10, offset: 0 },
        getMockM2MAdminAppContext()
      );

    const expected: m2mGatewayApiV3.EServiceDescriptorDeclaredAttributes = {
      results: expectedResults,
      pagination: { limit: 10, offset: 0, totalCount: 2 },
    };
    expect(result).toStrictEqual(expected);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetDeclaredAttributes,
      params: { eServiceId: eserviceId, descriptorId },
      queries: { offset: 0, limit: 10 },
    });
  });

  it("Should throw eserviceDescriptorAttributeNotFound when a reference cannot be resolved", async () => {
    const missingAttributeId = generateId();
    mockGetDeclaredAttributes.mockResolvedValueOnce(
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
      eserviceService.getEserviceDescriptorDeclaredAttributes(
        unsafeBrandId(eserviceId),
        unsafeBrandId(descriptorId),
        { limit: 10, offset: 0 },
        getMockM2MAdminAppContext()
      )
    ).rejects.toThrowError(
      eserviceDescriptorAttributeNotFound(unsafeBrandId(descriptorId))
    );
  });
});
