import { describe, it, expect } from "vitest";
import {
  getMockAttribute,
  getMockCertifiedTenantAttribute,
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Attribute,
  attributeKind,
  Descriptor,
  EService,
  generateId,
  genericError,
  TenantId,
} from "pagopa-interop-models";
import { PublicEService, PublicTenant } from "../src/models/models.js";
import {
  addOneAttribute,
  addOneEService,
  addOneTenant,
  dtdCatalogExporterService,
  getExportedDtdPublicCatalogFromCsv,
  getExportedDtdPublicCatalogFromJson,
  getExportedDtdPublicTenantsFromCsv,
} from "./utils.js";

describe("exportDtdPublicCatalog", () => {
  it("should correctly retrieve and remap eservices", async () => {
    const producerMock = getMockTenant();
    const attribute1Mock = getMockAttribute("Declared");
    const attribute2Mock = getMockAttribute("Declared");
    const attribute3Mock = getMockAttribute("Declared");

    const descriptorMock: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        certified: [],
        verified: [],
        declared: [
          [
            { id: attribute1Mock.id, explicitAttributeVerification: false },
            { id: attribute2Mock.id, explicitAttributeVerification: false },
          ],
          [{ id: attribute3Mock.id, explicitAttributeVerification: false }],
        ],
      },
    };
    const eserviceMock: EService = {
      ...getMockEService(),
      producerId: producerMock.id,
      descriptors: [descriptorMock],
    };

    await addOneEService(eserviceMock);
    await addOneTenant(producerMock);
    await addOneAttribute(attribute1Mock);
    await addOneAttribute(attribute2Mock);
    await addOneAttribute(attribute3Mock);

    await dtdCatalogExporterService.exportDtdData();

    const expectedEService: PublicEService = {
      activeDescriptor: {
        id: descriptorMock.id,
        state: descriptorMock.state.toUpperCase() as "PUBLISHED" | "SUSPENDED",
        version: descriptorMock.version,
      },
      technology: eserviceMock.technology.toUpperCase() as "REST" | "SOAP",
      producerId: producerMock.id,
      producerName: producerMock.name,
      producerExternalId: producerMock.externalId.value,
      id: eserviceMock.id,
      name: eserviceMock.name,
      description: eserviceMock.description,
      attributes: {
        certified: [],
        verified: [],
        declared: [
          {
            group: [
              {
                description: attribute1Mock.description,
                name: attribute1Mock.name,
              },
              {
                description: attribute2Mock.description,
                name: attribute2Mock.name,
              },
            ],
          },
          {
            single: {
              description: attribute3Mock.description,
              name: attribute3Mock.name,
            },
          },
        ],
      },
    };

    const jsonResult = await getExportedDtdPublicCatalogFromJson();
    expect(jsonResult.length).toBe(1);
    expect(jsonResult[0]).toEqual(expectedEService);

    const csvResult = await getExportedDtdPublicCatalogFromCsv();
    expect(csvResult.length).toBe(1);
    expect(csvResult[0]).toEqual(expectedEService);

    expect(csvResult).toEqual(jsonResult);
  });

  it("should correctly retrieve and remap tenants", async () => {
    const producerId = generateId<TenantId>();
    const producerAttribute = getMockCertifiedTenantAttribute();
    const producerMock = getMockTenant(producerId, [producerAttribute]);

    const descriptorMock: Descriptor = getMockDescriptorPublished();
    const eserviceMock: EService = {
      ...getMockEService(),
      producerId: producerMock.id,
      descriptors: [descriptorMock],
    };
    const attribute: Attribute = getMockAttribute(
      attributeKind.certified,
      producerAttribute.id
    );

    await addOneEService(eserviceMock);
    await addOneTenant(producerMock);
    await addOneAttribute(attribute);

    await dtdCatalogExporterService.exportDtdData();

    const expectedTenant: PublicTenant = {
      id: producerMock.id,
      name: producerMock.name,
      externalId: producerMock.externalId.value,
      attributes: [{ name: attribute.name, type: attribute.kind }],
    };

    const csvResult = await getExportedDtdPublicTenantsFromCsv();
    expect(csvResult.length).toBe(1);
    expect(csvResult[0]).toEqual(expectedTenant);
  });

  it("should ignore eservices with no active descriptor", async () => {
    const producerMock = getMockTenant();
    const descriptorMock = getMockDescriptorPublished();
    const eserviceMock: EService = {
      ...getMockEService(),
      producerId: producerMock.id,
      descriptors: [descriptorMock],
    };

    const draftDescriptorMock: Descriptor = {
      ...getMockDescriptorPublished(),
      state: "Draft",
    };
    const eserviceWithNoActiveDescriptorMock: EService = {
      ...getMockEService(),
      producerId: producerMock.id,
      descriptors: [draftDescriptorMock],
    };

    await addOneEService(eserviceMock);
    await addOneEService(eserviceWithNoActiveDescriptorMock);
    await addOneTenant(producerMock);

    await dtdCatalogExporterService.exportDtdData();
    const result = await getExportedDtdPublicCatalogFromJson();

    expect(result.length).toBe(1);
    expect(
      result.find((r) => r.id === eserviceWithNoActiveDescriptorMock.id)
    ).toBeUndefined();
  });

  it("should throw an error if the eservice producer is not present in the readmodel", async () => {
    const producerMock = getMockTenant();
    const descriptorMock = getMockDescriptorPublished();
    const eserviceMock: EService = {
      ...getMockEService(),
      producerId: producerMock.id,
      descriptors: [descriptorMock],
    };

    await addOneEService(eserviceMock);

    await expect(async () => {
      await dtdCatalogExporterService.exportDtdData();
    }).rejects.toThrowError(
      genericError(`Producer for e-service ${eserviceMock.id} not found`)
    );
  });

  it("should throw an error if an eservice attribute is not present in the readmodel", async () => {
    const producerMock = getMockTenant();
    const attributeMock = getMockAttribute("Declared");

    const descriptorMock: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        certified: [],
        verified: [],
        declared: [
          [{ id: attributeMock.id, explicitAttributeVerification: false }],
        ],
      },
    };

    const eserviceMock: EService = {
      ...getMockEService(),
      producerId: producerMock.id,
      descriptors: [descriptorMock],
    };

    await addOneEService(eserviceMock);
    await addOneTenant(producerMock);

    await expect(async () => {
      await dtdCatalogExporterService.exportDtdData();
    }).rejects.toThrowError(
      genericError(`Attribute with id ${attributeMock.id} not found`)
    );
  });
});
