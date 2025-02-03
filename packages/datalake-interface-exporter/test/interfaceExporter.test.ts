import { describe, expect, it } from "vitest";
import {
  getMockDescriptor,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  EServiceDocumentId,
  EServiceId,
  generateId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { config } from "../src/config/config.js";
import { exportInterface } from "../src/interfaceExporter.js";
import { fileManager } from "./utils.js";

describe("interfaceExporter", () => {
  it("should export interface files for a descriptor", async () => {
    const mockEserviceId1 = generateId<EServiceId>();
    const mockDocumentId1 = generateId<EServiceDocumentId>();
    const mockDocument1 = {
      ...getMockDocument(),
      id: mockDocumentId1,
      name: "document1.json",
      path: `interop-eservice-documents/${mockDocumentId1}/document1.json`,
    };
    const mockDescriptor1: Descriptor = {
      ...getMockDescriptor(),
      interface: mockDocument1,
    };

    const mockEserviceId2 = generateId<EServiceId>();
    const mockDocumentId2 = generateId<EServiceDocumentId>();
    const mockDocument2 = {
      ...getMockDocument(),
      id: mockDocumentId2,
      name: "document2.txt",
      path: `interop-eservice-documents/${mockDocumentId2}/document2.txt`,
    };
    const mockDescriptor2: Descriptor = {
      ...getMockDescriptor(),
      interface: mockDocument2,
    };

    await fileManager.storeBytes(
      {
        bucket: config.eserviceDocumentsS3Bucket,
        path: "interop-eservice-documents",
        resourceId: mockDocument1.id,
        name: mockDocument1.name,
        content: Buffer.from("test-content"),
      },
      genericLogger
    );

    await fileManager.storeBytes(
      {
        bucket: config.eserviceDocumentsS3Bucket,
        path: "interop-eservice-documents",
        resourceId: mockDocument2.id,
        name: mockDocument2.name,
        content: Buffer.from("test-content"),
      },
      genericLogger
    );

    await exportInterface(
      mockEserviceId1,
      mockDescriptor1,
      fileManager,
      genericLogger
    );

    await exportInterface(
      mockEserviceId2,
      mockDescriptor2,
      fileManager,
      genericLogger
    );

    expect(
      await fileManager.listFiles(
        config.datalakeInterfacesExportS3Bucket,
        genericLogger
      )
    ).toContain(
      `${config.datalakeInterfacesExportPath}/${mockEserviceId1}/${mockDescriptor1.id}/${mockDocument1.name}`
    );

    expect(
      await fileManager.listFiles(
        config.datalakeInterfacesExportS3Bucket,
        genericLogger
      )
    ).toContain(
      `${config.datalakeInterfacesExportPath}/${mockEserviceId2}/${mockDescriptor2.id}/${mockDocument2.name}`
    );
  });

  it("should fail if descriptor does not have an interface", async () => {
    const mockEserviceId = generateId<EServiceId>();
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: undefined,
    };
    await expect(
      exportInterface(
        mockEserviceId,
        mockDescriptor,
        fileManager,
        genericLogger
      )
    ).rejects.toThrow();
  });
});
