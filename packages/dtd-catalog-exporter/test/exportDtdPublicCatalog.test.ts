import { describe, it, expect } from "vitest";
import {
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { Descriptor, EService } from "pagopa-interop-models";
import {
  addOneEService,
  addOneTenant,
  dtdCatalogExporterService,
  getExportDtdPublicCatalogResult,
} from "./utils";

describe("exportDtdPublicCatalog", () => {
  it("should correctly retrieve and remap eservices", async () => {
    const producerMock = getMockTenant();
    const descriptorMock = getMockDescriptorPublished();
    const eserviceMock: EService = {
      ...getMockEService(),
      producerId: producerMock.id,
      descriptors: [descriptorMock],
    };

    await addOneEService(eserviceMock);
    await addOneTenant(producerMock);

    await dtdCatalogExporterService.exportDtdPublicCatalog();
    const result = await getExportDtdPublicCatalogResult();

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      activeDescriptor: {
        id: descriptorMock.id,
        state: descriptorMock.state.toUpperCase(),
        version: descriptorMock.version,
      },
      technology: eserviceMock.technology.toUpperCase(),
      producerName: producerMock.name,
      id: eserviceMock.id,
      name: eserviceMock.name,
      description: eserviceMock.description,
      attributes: { certified: [], verified: [], declared: [] },
    });
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

    await dtdCatalogExporterService.exportDtdPublicCatalog();
    const result = await getExportDtdPublicCatalogResult();

    expect(result.length).toBe(1);
    expect(
      result.find((r) => r.id === eserviceWithNoActiveDescriptorMock.id)
    ).toBeUndefined();
  });
});
