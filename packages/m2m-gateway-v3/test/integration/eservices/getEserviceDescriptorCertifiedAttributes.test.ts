import {
  attributeRegistryApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import { genericLogger } from "pagopa-interop-commons";
import { getMockWithMetadata } from "pagopa-interop-commons-test";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { toM2MGatewayApiCertifiedAttribute } from "../../../src/api/attributeApiConverter.js";
import { PagoPAInteropBeClients } from "../../../src/clients/clientsProvider.js";
import { eserviceDescriptorAttributeNotFound } from "../../../src/model/errors.js";
import {
  eserviceService,
  expectApiClientGetToHaveBeenCalledWith,
  mockInteropBeClients,
} from "../../integrationUtils.js";
import { getMockM2MAdminAppContext } from "../../mockUtils.js";

describe("getEserviceDescriptorCertifiedAttributes", () => {
  const eserviceId = generateId();
  const descriptorId = generateId();

  const bulkAttribute1: attributeRegistryApi.Attribute = {
    code: "code1",
    id: generateId(),
    name: "Attribute Name 1",
    creationTime: new Date().toISOString(),
    description: "Description 1",
    origin: "Origin 1",
    kind: "CERTIFIED",
  };
  const bulkAttribute2: attributeRegistryApi.Attribute = {
    code: "code2",
    id: generateId(),
    name: "Attribute Name 2",
    creationTime: new Date().toISOString(),
    description: "Description 2",
    origin: "Origin 2",
    kind: "CERTIFIED",
  };
  const bulkAttribute3: attributeRegistryApi.Attribute = {
    code: "code3",
    id: generateId(),
    name: "Attribute Name 3",
    creationTime: new Date().toISOString(),
    description: "Description 3",
    origin: "Origin 3",
    kind: "CERTIFIED",
  };

  // catalog-process returns a page of `{ id, groupIndex }` references (with
  // pagination and visibility already applied); the gateway resolves them.
  const mockGetCertifiedAttributes = vi.fn().mockResolvedValue(
    getMockWithMetadata({
      results: [
        { id: bulkAttribute1.id, groupIndex: 0 },
        { id: bulkAttribute2.id, groupIndex: 0 },
        { id: bulkAttribute3.id, groupIndex: 1 },
      ],
      totalCount: 3,
    })
  );

  const mockGetBulkedAttributes = vi.fn().mockResolvedValue({
    data: {
      results: [bulkAttribute1, bulkAttribute2, bulkAttribute3],
      totalCount: 3,
    },
    metadata: {},
  });

  mockInteropBeClients.catalogProcessClient = {
    getEServiceDescriptorCertifiedAttributes: mockGetCertifiedAttributes,
  } as unknown as PagoPAInteropBeClients["catalogProcessClient"];

  mockInteropBeClients.attributeProcessClient = {
    getBulkedAttributes: mockGetBulkedAttributes,
  } as unknown as PagoPAInteropBeClients["attributeProcessClient"];

  const expectedResults = [
    {
      groupIndex: 0,
      attribute: toM2MGatewayApiCertifiedAttribute({
        attribute: bulkAttribute1,
        logger: genericLogger,
      }),
    },
    {
      groupIndex: 0,
      attribute: toM2MGatewayApiCertifiedAttribute({
        attribute: bulkAttribute2,
        logger: genericLogger,
      }),
    },
    {
      groupIndex: 1,
      attribute: toM2MGatewayApiCertifiedAttribute({
        attribute: bulkAttribute3,
        logger: genericLogger,
      }),
    },
  ];

  beforeEach(() => {
    mockGetCertifiedAttributes.mockClear();
    mockGetBulkedAttributes.mockClear();
  });

  it("Should delegate pagination to catalog-process and resolve the attributes", async () => {
    const result =
      await eserviceService.getEserviceDescriptorCertifiedAttributes(
        unsafeBrandId(eserviceId),
        unsafeBrandId(descriptorId),
        { limit: 10, offset: 0 },
        getMockM2MAdminAppContext()
      );

    const expected: m2mGatewayApiV3.EServiceDescriptorCertifiedAttributes = {
      results: expectedResults,
      pagination: { limit: 10, offset: 0, totalCount: 3 },
    };
    expect(result).toStrictEqual(expected);

    expectApiClientGetToHaveBeenCalledWith({
      mockGet: mockGetCertifiedAttributes,
      params: { eServiceId: eserviceId, descriptorId },
      queries: { offset: 0, limit: 10 },
    });
    expect(mockGetBulkedAttributes).toHaveBeenCalledWith(
      [bulkAttribute1.id, bulkAttribute2.id, bulkAttribute3.id],
      expect.objectContaining({ queries: { limit: 50, offset: 0 } })
    );
  });

  it("Should throw eserviceDescriptorAttributeNotFound when a reference cannot be resolved", async () => {
    const missingAttributeId = generateId();
    mockGetCertifiedAttributes.mockResolvedValueOnce(
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
      eserviceService.getEserviceDescriptorCertifiedAttributes(
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
