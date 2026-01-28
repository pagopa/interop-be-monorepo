import { describe, it, expect, vi } from "vitest";
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
  convertEservicesToCSV,
  convertTenantsToCSV,
} from "../src/services/dtdCatalogExporterService.js";
import {
  addOneEService,
  addOneTenant,
  addOneAttribute,
  dtdCatalogExporterService,
  getExportedDtdPublicCatalogFromJson,
} from "./utils.js";

describe("exportDtdPublicCatalog", () => {
  vi.mock("../src/services/github-client.services.ts", () => ({
    GithubClient: class MockGithubClient {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      constructor(_accessToken: string) {}

      public async createOrUpdateRepoFile(
        _content: string,
        _owner: string,
        _repo: string,
        _path: string,
        _message?: string
      ): Promise<void> {
        return Promise.resolve();
      }
    },
  }));

  it("should correctly retrieve and remap eservices from json file", async () => {
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
          [{ id: attribute1Mock.id }, { id: attribute2Mock.id }],
          [{ id: attribute3Mock.id }],
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
      producerIpaCode: producerMock.externalId.value,
      producerFiscalCode: null,
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
        declared: [[{ id: attributeMock.id }]],
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

  it("should correctly convert eservices to a csv", async () => {
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
          [{ id: attribute1Mock.id }, { id: attribute2Mock.id }],
          [{ id: attribute3Mock.id }],
        ],
      },
    };
    const eserviceMock: EService = {
      ...getMockEService(),
      producerId: producerMock.id,
      descriptors: [descriptorMock],
    };

    const publicEservice: PublicEService = {
      activeDescriptor: {
        id: descriptorMock.id,
        state: descriptorMock.state.toUpperCase() as "PUBLISHED" | "SUSPENDED",
        version: descriptorMock.version,
      },
      technology: eserviceMock.technology.toUpperCase() as "REST" | "SOAP",
      producerId: producerMock.id,
      producerName: producerMock.name,
      producerIpaCode: producerMock.externalId.value,
      producerFiscalCode: null,
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

    const csvContent = convertEservicesToCSV([publicEservice]);

    const csvAttributes = `"${JSON.stringify(publicEservice.attributes).replace(
      /"/g,
      '""'
    )}"`;
    const expectedCsv = `id,name,description,technology,producerId,producerName,producerFiscalCode,producerIpaCode,attributes,activeDescriptorId,activeDescriptorState,activeDescriptorVersion\n${publicEservice.id},${publicEservice.name},${publicEservice.description},${publicEservice.technology},${publicEservice.producerId},${publicEservice.producerName},,${publicEservice.producerIpaCode},${csvAttributes},${publicEservice.activeDescriptor.id},${publicEservice.activeDescriptor.state},${publicEservice.activeDescriptor.version}\n`;

    expect(csvContent).toEqual(expectedCsv);
  });

  it("should correctly convert tenants to a csv", async () => {
    const producerId = generateId<TenantId>();
    const producerAttribute = getMockCertifiedTenantAttribute();
    const producerMock = getMockTenant(producerId, [producerAttribute]);

    const attribute: Attribute = getMockAttribute(
      attributeKind.certified,
      producerAttribute.id
    );

    const publicTenant: PublicTenant = {
      id: producerMock.id,
      name: producerMock.name,
      ipaCode: producerMock.externalId.value,
      fiscalCode: null,
      attributes: [{ name: attribute.name, type: attribute.kind }],
    };

    const csvContent = convertTenantsToCSV([publicTenant]);

    const expectedCsv = `id,name,fiscalCode,ipaCode,attributes\n${producerMock.id},${producerMock.name},,${producerMock.externalId.value},"[{""name"":""${attribute.name}"",""type"":""${attribute.kind}""}]"\n`;

    expect(csvContent).toEqual(expectedCsv);
  });
});
