/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */
import { describe, it, expect, beforeEach } from "vitest";
import {
  EServiceAddedV1,
  EServiceDeletedV1,
  EServiceDescriptorAddedV1,
  EServiceDocumentAddedV1,
  EServiceRiskAnalysisDeletedV1,
  EServiceEventEnvelopeV1,
  EServiceAddedV2,
  EServiceDeletedV2,
  EServiceDescriptorAddedV2,
  EServiceRiskAnalysisDeletedV2,
  EServiceEventEnvelopeV2,
  toDocumentV2,
  toEServiceV2,
  EServiceDescriptorDocumentAddedV2,
  generateId,
  Descriptor,
  EService,
  descriptorState,
  EServiceDescriptorPublishedV2,
} from "pagopa-interop-models";
import {
  getMockEService,
  getMockDescriptor,
  getMockDocument,
  getMockValidRiskAnalysis,
  toEServiceV1,
  toDescriptorV1,
  toDocumentV1,
  getMockEServiceAttribute,
  getMockAttribute,
} from "pagopa-interop-commons-test";
import { handleCatalogMessageV1 } from "../src/handlers/catalog/consumerServiceV1.js";
import { handleCatalogMessageV2 } from "../src/handlers/catalog/consumerServiceV2.js";
import { CatalogDbTable } from "../src/model/db/index.js";
import {
  dbContext,
  getOneFromDb,
  getManyFromDb,
  catalogTables,
  resetTargetTables,
} from "./utils.js";

describe("Catalog messages consumers - handleCatalogMessageV1", () => {
  beforeEach(async () => {
    await dbContext.conn.none("SET standard_conforming_strings = off");
    await resetTargetTables(catalogTables);
  });

  it("EServiceAdded: inserts eService with descriptors, docs, interfaces, riskAnalysis", async () => {
    const mock = getMockEService();
    const descriptor = getMockDescriptor();
    descriptor.description = "Escape sanitize test\\";
    const interfaceId = generateId();
    descriptor.interface = {
      path: "path",
      id: interfaceId as any,
      name: "name",
      prettyName: "pretty name",
      contentType: "",
      checksum: "",
      uploadDate: new Date(),
    };
    const document = getMockDocument();
    descriptor.docs = [document];
    const certifiedAttribute = getMockEServiceAttribute();
    descriptor.attributes = {
      certified: [[certifiedAttribute]],
      declared: [],
      verified: [],
    };
    const risk = getMockValidRiskAnalysis("PA");
    const eserviceWithSubs = {
      ...mock,
      descriptors: [descriptor],
      riskAnalysis: [risk],
    };

    const payload: EServiceAddedV1 = {
      eservice: toEServiceV1(eserviceWithSubs),
    };
    const msg: EServiceEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      type: "EServiceAdded",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };
    await handleCatalogMessageV1([msg], dbContext);

    const storedEservice = await getOneFromDb(
      dbContext,
      CatalogDbTable.eservice,
      { id: mock.id }
    );
    expect(storedEservice).toBeDefined();
    expect(storedEservice?.metadataVersion).toBe(1);

    const storedDescriptors = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor,
      { id: descriptor.id }
    );
    expect(storedDescriptors.length).toBe(1);

    const storedInterfaces = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_interface,
      { id: interfaceId }
    );
    expect(storedInterfaces.length).toBeGreaterThan(0);

    const storedDocuments = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_document,
      { id: document.id }
    );
    expect(storedDocuments.length).toBeGreaterThan(0);

    const storedRiskAnalysis = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_risk_analysis,
      { id: risk.id }
    );
    expect(storedRiskAnalysis.length).toBeGreaterThan(0);
  });

  it("EServiceDescriptorAdded: inserts descriptor with attributes, rejection reasons, template refs", async () => {
    const mock = getMockEService();
    const descriptor = getMockDescriptor();
    const certifiedAttribute = getMockEServiceAttribute();
    descriptor.attributes = {
      certified: [[certifiedAttribute]],
      declared: [],
      verified: [],
    };
    descriptor.rejectionReasons = [
      { rejectionReason: "rejection reason", rejectedAt: new Date() },
    ];
    const templateVersionRefId = generateId();
    descriptor.templateVersionRef = { id: templateVersionRefId as any };

    await handleCatalogMessageV1(
      [
        {
          sequence_num: 1,
          stream_id: mock.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 1,
          data: { eservice: toEServiceV1(mock) },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const payload: EServiceDescriptorAddedV1 = {
      eserviceId: mock.id,
      eserviceDescriptor: toDescriptorV1(descriptor),
    };
    const msg: EServiceEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      type: "EServiceDescriptorAdded",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };
    await handleCatalogMessageV1([msg], dbContext);

    const storedDescs = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor,
      { id: descriptor.id }
    );
    expect(storedDescs.length).toBe(1);
    expect(storedDescs[0].metadataVersion).toBe(2);

    const attrs = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_attribute,
      { descriptorId: descriptor.id }
    );
    expect(attrs.length).toBeGreaterThan(0);

    const reasons = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_rejection_reason,
      { descriptorId: descriptor.id }
    );
    expect(reasons.length).toBeGreaterThan(0);

    const tmplRefs = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_template_version_ref,
      { eserviceTemplateVersionId: templateVersionRefId }
    );
    expect(tmplRefs.length).toBeGreaterThan(0);
  });

  it("EServiceDescriptorUpdated: removes verified attributes when a descriptor is updated", async () => {
    const eservice = getMockEService();

    const certifiedAttr = { ...getMockAttribute(), kind: "Certified" };
    const declaredAttr = { ...getMockAttribute(), kind: "Declared" };
    const verifiedAttr = { ...getMockAttribute(), kind: "Verified" };

    const descriptors = Array.from({ length: 3 }, () => ({
      ...getMockDescriptor(),
      metadataVersion: 1,
    }));

    descriptors[0].attributes = {
      certified: [[getMockEServiceAttribute(certifiedAttr.id)]],
      declared: [[getMockEServiceAttribute(declaredAttr.id)]],
      verified: [[getMockEServiceAttribute(verifiedAttr.id)]],
    };

    eservice.descriptors = descriptors;

    const event1: EServiceEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: eservice.id,
      version: 1,
      type: "EServiceAdded",
      event_version: 1,
      data: {
        eservice: toEServiceV1({
          ...eservice,
          riskAnalysis: [],
        }),
      },
      log_date: new Date(),
    };

    const descriptorV1 = toDescriptorV1(descriptors[0]);

    const event2: EServiceEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: eservice.id,
      version: 2,
      type: "EServiceDescriptorUpdated",
      event_version: 1,
      data: {
        eserviceDescriptor: descriptorV1,
        eserviceId: eservice.id,
      },
      log_date: new Date(),
    };

    const updatedDescriptor = {
      ...descriptors[0],
      attributes: {
        certified: [[getMockEServiceAttribute(certifiedAttr.id)]],
        declared: [[getMockEServiceAttribute(declaredAttr.id)]],
        verified: [],
      },
    };

    const updatedEService: EServiceAddedV1 = {
      eservice: toEServiceV1({
        ...eservice,
        descriptors: [updatedDescriptor],
        riskAnalysis: [],
      }),
    };

    const event3: EServiceEventEnvelopeV1 = {
      sequence_num: 3,
      stream_id: eservice.id,
      version: 3,
      type: "EServiceDescriptorUpdated",
      event_version: 1,
      data: {
        eserviceDescriptor: updatedEService.eservice?.descriptors[0],
        eserviceId: eservice.id,
      },
      log_date: new Date(),
    };

    await handleCatalogMessageV1([event1, event2, event3], dbContext);

    const storedDescriptors = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor,
      { eserviceId: eservice.id }
    );

    const storedAttributes = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_attribute,
      { descriptorId: updatedDescriptor.id }
    );

    expect(storedDescriptors.length).toBe(3);
    expect(
      storedAttributes.filter((attr) => attr.kind === "Verified")
    ).toHaveLength(0);
    expect(
      storedAttributes.filter((attr) => attr.kind === "Certified")
    ).toHaveLength(1);
    expect(
      storedAttributes.filter((attr) => attr.kind === "Declared")
    ).toHaveLength(1);
  });

  it("EServiceDocumentAdded: inserts new document", async () => {
    const mock = getMockEService();
    const descriptor = getMockDescriptor();
    const document = getMockDocument();

    await handleCatalogMessageV1(
      [
        {
          sequence_num: 1,
          stream_id: mock.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 1,
          data: { eservice: toEServiceV1(mock) },
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: mock.id,
          version: 2,
          type: "EServiceDescriptorAdded",
          event_version: 1,
          data: {
            eserviceId: mock.id,
            eserviceDescriptor: toDescriptorV1({ ...descriptor, docs: [] }),
          },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const payload: EServiceDocumentAddedV1 = {
      eserviceId: mock.id,
      descriptorId: descriptor.id,
      serverUrls: [],
      document: toDocumentV1({
        ...document,
        uploadDate: new Date(),
      }),
      isInterface: false,
    };
    const msg: EServiceEventEnvelopeV1 = {
      sequence_num: 3,
      stream_id: mock.id,
      version: 3,
      type: "EServiceDocumentAdded",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };
    await handleCatalogMessageV1([msg], dbContext);

    const stored = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_document,
      { id: document.id }
    );

    expect(stored.length).toBeGreaterThan(0);
    expect(stored[0].metadataVersion).toBe(3);
  });

  it("EServiceDocumentAdded: upserts interface when isInterface is true and removes serverUrls from descriptor", async () => {
    const mock = getMockEService();
    const descriptor = getMockDescriptor();
    const interfaceDoc = getMockDocument();

    const msg1: EServiceEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      type: "EServiceAdded",
      event_version: 1,
      data: { eservice: toEServiceV1(mock) },
      log_date: new Date(),
    };

    const msg2: EServiceEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      type: "EServiceDescriptorAdded",
      event_version: 1,
      data: {
        eserviceId: mock.id,
        eserviceDescriptor: toDescriptorV1({ ...descriptor, docs: [] }),
      },
      log_date: new Date(),
    };

    const payload: EServiceDocumentAddedV1 = {
      eserviceId: mock.id,
      descriptorId: descriptor.id,
      serverUrls: [],
      document: toDocumentV1({ ...interfaceDoc, uploadDate: new Date() }),
      isInterface: true,
    };
    const msg3: EServiceEventEnvelopeV1 = {
      sequence_num: 3,
      stream_id: mock.id,
      version: 3,
      type: "EServiceDocumentAdded",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    await handleCatalogMessageV1([msg1, msg2, msg3], dbContext);

    const storedInterface = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_interface,
      { id: interfaceDoc.id }
    );
    expect(storedInterface.length).toBeGreaterThan(0);

    const storedDescriptor = await getOneFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor,
      { id: descriptor.id }
    );

    expect(storedDescriptor?.serverUrls).to.equal("[]");
  });

  it("EServiceDocumentUpdated: upsert interface when serverUrls are lenght > 0 and overwrite descriptor serverUrls", async () => {
    const eservice = getMockEService();
    const document = toDocumentV1({
      id: generateId(),
      name: "Security Policy",
      prettyName: "Security Policy.pdf",
      path: "/docs/security.pdf",
      contentType: "application/pdf",
      checksum: "xyz789",
      uploadDate: new Date(),
    });
    const descriptor = {
      ...getMockDescriptor(),
      eserviceId: eservice.id,
    };

    eservice.descriptors = [descriptor];

    const addEvent: EServiceEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: eservice.id,
      version: 1,
      type: "EServiceAdded",
      event_version: 1,
      data: {
        eservice: toEServiceV1({
          ...eservice,
          riskAnalysis: [],
        }),
      },
      log_date: new Date(),
    };

    const updateDocEvent: EServiceEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: eservice.id,
      version: 2,
      type: "EServiceDocumentUpdated",
      event_version: 1,
      data: {
        updatedDocument: { ...document, name: "interface name updated" },
        documentId: document.id,
        descriptorId: descriptor.id,
        eserviceId: eservice.id,
        serverUrls: ["newServerUrl"],
      },
      log_date: new Date(),
    };
    await handleCatalogMessageV1([addEvent, updateDocEvent], dbContext);

    const storedInterface = await getOneFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_interface,
      { id: document.id }
    );

    expect(storedInterface?.name).toBe("interface name updated");

    const storedDescriptor = await getOneFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor,
      { id: descriptor.id }
    );
    const serverUrls = JSON.parse(storedDescriptor?.serverUrls ?? "error");
    expect(serverUrls).toStrictEqual(["newServerUrl"]);
  });

  it("EServiceDocumentUpdated: upsert document when serverUrls is empty", async () => {
    const eservice = getMockEService();
    const document = toDocumentV1({
      id: generateId(),
      name: "Security Policy",
      prettyName: "Security Policy.pdf",
      path: "/docs/security.pdf",
      contentType: "application/pdf",
      checksum: "xyz789",
      uploadDate: new Date(),
    });
    const descriptor = {
      ...getMockDescriptor(),
      eserviceId: eservice.id,
    };

    eservice.descriptors = [descriptor];

    const addEvent: EServiceEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: eservice.id,
      version: 1,
      type: "EServiceAdded",
      event_version: 1,
      data: {
        eservice: toEServiceV1({
          ...eservice,
          riskAnalysis: [],
        }),
      },
      log_date: new Date(),
    };

    const updateDocEvent: EServiceEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: eservice.id,
      version: 2,
      type: "EServiceDocumentUpdated",
      event_version: 1,
      data: {
        updatedDocument: { ...document, name: "document name updated" },
        documentId: document.id,
        descriptorId: descriptor.id,
        eserviceId: eservice.id,
        serverUrls: [],
      },
      log_date: new Date(),
    };
    await handleCatalogMessageV1([addEvent, updateDocEvent], dbContext);

    const storedInterface = await getOneFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_document,
      { id: document.id }
    );

    expect(storedInterface?.name).toBe("document name updated");
  });

  it("EServiceDocumentDeleted: deletes interface or document based on existence", async () => {
    const mock = getMockEService();
    const descriptor = getMockDescriptor();
    const document = getMockDocument();
    const interf = getMockDocument();

    const msg1: EServiceEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      type: "EServiceAdded",
      event_version: 1,
      data: { eservice: toEServiceV1(mock) },
      log_date: new Date(),
    };

    const msg2: EServiceEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      type: "EServiceDescriptorAdded",
      event_version: 1,
      data: {
        eserviceId: mock.id,
        eserviceDescriptor: toDescriptorV1({
          ...descriptor,
          docs: [document],
          interface: interf,
        }),
      },
      log_date: new Date(),
    };

    const msg3: EServiceEventEnvelopeV1 = {
      sequence_num: 3,
      stream_id: mock.id,
      version: 3,
      type: "EServiceDocumentDeleted",
      event_version: 1,
      data: {
        eserviceId: mock.id,
        documentId: interf.id,
        descriptorId: descriptor.id,
      },
      log_date: new Date(),
    };

    const msg4: EServiceEventEnvelopeV1 = {
      sequence_num: 4,
      stream_id: mock.id,
      version: 4,
      type: "EServiceDocumentDeleted",
      event_version: 1,
      data: {
        eserviceId: mock.id,
        documentId: document.id,
        descriptorId: descriptor.id,
      },
      log_date: new Date(),
    };

    await handleCatalogMessageV1([msg1, msg2, msg3, msg4], dbContext);

    const deletedInterface = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_interface,
      { id: interf.id }
    );
    expect(deletedInterface.length).toBe(0);

    const deletedDocument = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_document,
      { id: document.id }
    );
    expect(deletedDocument.length).toBe(0);

    const updatedDescriptor = await getOneFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor,
      { id: descriptor.id }
    );
    expect(updatedDescriptor?.serverUrls).to.equal("[]");
  });

  it("EServiceRiskAnalysisDeleted: removes RiskAnalysis", async () => {
    const mock = getMockEService();
    const risk = getMockValidRiskAnalysis("PA");

    await handleCatalogMessageV1(
      [
        {
          sequence_num: 1,
          stream_id: mock.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 1,
          data: { eservice: toEServiceV1({ ...mock, riskAnalysis: [risk] }) },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const msg: EServiceEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      type: "EServiceRiskAnalysisDeleted",
      event_version: 1,
      data: {
        riskAnalysisId: risk.id,
        eservice: toEServiceV1(mock),
      } as EServiceRiskAnalysisDeletedV1,
      log_date: new Date(),
    };
    await handleCatalogMessageV1([msg], dbContext);

    const storedRisk = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_risk_analysis,
      { id: risk.id }
    );
    expect(storedRisk.length).toBe(0);
  });

  it("EServiceWithDescriptorsDeleted: removes descriptor", async () => {
    const descriptorInterface = getMockDocument();
    const document = getMockDocument();
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: descriptorInterface,
      attributes: {
        certified: [[getMockEServiceAttribute()]],
        declared: [],
        verified: [],
      },
      docs: [document],
    };

    const riskAnalysis = getMockValidRiskAnalysis("PA");

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      riskAnalysis: [riskAnalysis],
    };

    const payload: EServiceAddedV1 = {
      eservice: toEServiceV1(eservice),
    };
    await handleCatalogMessageV1(
      [
        {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 1,
          data: {
            eservice: payload.eservice,
          },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const storedDescriptorBefore = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor,
      { id: eservice.descriptors[0].id }
    );
    const storedAttributesBefore = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_attribute,
      { descriptorId: eservice.descriptors[0].id }
    );
    const storedDocsBefore = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_document,
      { descriptorId: eservice.descriptors[0].id }
    );
    const storedInterfaceBefore = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_interface,
      { descriptorId: eservice.descriptors[0].id }
    );

    expect(storedDescriptorBefore.length).toBe(1);
    expect(storedAttributesBefore.length).toBe(1);
    expect(storedDocsBefore.length).toBe(1);
    expect(storedInterfaceBefore.length).toBe(1);
    expect(storedDescriptorBefore.length).toBe(1);

    const msg: EServiceEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: eservice.id,
      version: 2,
      type: "EServiceWithDescriptorsDeleted",
      event_version: 1,
      data: {
        descriptorId: eservice.descriptors[0].id,
      },
      log_date: new Date(),
    };
    await handleCatalogMessageV1([msg], dbContext);

    const storedDescriptorAfter = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor,
      { id: eservice.descriptors[0].id }
    );
    const storedAttributesAfter = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_attribute,
      { descriptorId: eservice.descriptors[0].id }
    );
    const storedDocsAfter = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_document,
      { descriptorId: eservice.descriptors[0].id }
    );
    const storedInterfaceAfter = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_interface,
      { descriptorId: eservice.descriptors[0].id }
    );
    expect(storedDescriptorAfter.length).toBe(0);
    expect(storedAttributesAfter.length).toBe(0);
    expect(storedDocsAfter.length).toBe(0);
    expect(storedInterfaceAfter.length).toBe(0);
  });

  it("EServiceDeleted: marks eService and all subobjects deleted", async () => {
    const mock = getMockEService();
    const descriptor = getMockDescriptor();
    const document = getMockDocument();
    const risk = getMockValidRiskAnalysis("PA");

    await handleCatalogMessageV1(
      [
        {
          sequence_num: 1,
          stream_id: mock.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 1,
          data: {
            eservice: toEServiceV1({
              ...mock,
              descriptors: [descriptor],
              riskAnalysis: [risk],
            }),
          },
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: mock.id,
          version: 2,
          type: "EServiceDescriptorAdded",
          event_version: 1,
          data: {
            eserviceId: mock.id,
            eserviceDescriptor: toDescriptorV1({
              ...descriptor,
              docs: [document],
            }),
          },
          log_date: new Date(),
        },
        {
          sequence_num: 3,
          stream_id: mock.id,
          version: 3,
          type: "EServiceDocumentAdded",
          event_version: 1,
          data: {
            eserviceId: mock.id,
            descriptorId: descriptor.id,
            serverUrls: [],
            document: toDocumentV1({
              ...document,
              uploadDate: new Date(),
            }),
            isInterface: false,
          },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const msg: EServiceEventEnvelopeV1 = {
      sequence_num: 4,
      stream_id: mock.id,
      version: 4,
      type: "EServiceDeleted",
      event_version: 1,
      data: { eserviceId: mock.id } as EServiceDeletedV1,
      log_date: new Date(),
    };
    await handleCatalogMessageV1([msg], dbContext);

    const storedEservice = await getOneFromDb(
      dbContext,
      CatalogDbTable.eservice,
      { id: mock.id }
    );
    expect(storedEservice?.deleted).toBe(true);

    (
      await getManyFromDb(dbContext, CatalogDbTable.eservice_descriptor, {
        id: descriptor.id,
      })
    ).forEach((d) => expect(d.deleted).toBe(true));

    (
      await getManyFromDb(
        dbContext,
        CatalogDbTable.eservice_descriptor_document,
        { id: document.id }
      )
    ).forEach((d) => expect(d.deleted).toBe(true));

    (
      await getManyFromDb(dbContext, CatalogDbTable.eservice_risk_analysis, {
        id: risk.id,
      })
    ).forEach((r) => expect(r.deleted).toBe(true));
  });
});

describe("Catalog messages consumers - handleCatalogMessageV2", () => {
  beforeEach(async () => {
    await resetTargetTables(catalogTables);
  });

  it("EServiceAdded: inserts eService with descriptors, docs, interfaces, riskAnalysis", async () => {
    const mock = getMockEService();
    const descriptor = getMockDescriptor();
    const interfaceId = generateId();
    descriptor.interface = {
      path: "path",
      id: interfaceId as any,
      name: "name",
      prettyName: "pretty name",
      contentType: "",
      checksum: "",
      uploadDate: new Date(),
    };
    const document = getMockDocument();
    descriptor.docs = [document];
    const certifiedAttribute = getMockEServiceAttribute();
    descriptor.attributes = {
      certified: [[certifiedAttribute]],
      declared: [],
      verified: [],
    };
    const risk = getMockValidRiskAnalysis("PA");
    const eserviceWithSubs = {
      ...mock,
      descriptors: [descriptor],
      riskAnalysis: [risk],
    };

    const payload: EServiceAddedV2 = {
      eservice: toEServiceV2(eserviceWithSubs),
    };
    const msg: EServiceEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      type: "EServiceAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };
    await handleCatalogMessageV2([msg], dbContext);

    const storedEservice = await getOneFromDb(
      dbContext,
      CatalogDbTable.eservice,
      { id: mock.id }
    );
    expect(storedEservice).toBeDefined();
    expect(storedEservice?.metadataVersion).toBe(1);

    const storedDescriptors = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor,
      { id: descriptor.id }
    );
    expect(storedDescriptors.length).toBe(1);

    const storedInterfaces = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_interface,
      { id: interfaceId }
    );
    expect(storedInterfaces.length).toBeGreaterThan(0);

    const storedDocuments = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_document,
      { id: document.id }
    );
    expect(storedDocuments.length).toBeGreaterThan(0);

    const storedRiskAnalysis = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_risk_analysis,
      { id: risk.id }
    );
    expect(storedRiskAnalysis.length).toBeGreaterThan(0);
  });

  it("EServiceDescriptorAdded: inserts descriptor with attributes, rejection reasons, template refs", async () => {
    const mock = getMockEService();
    const descriptor = getMockDescriptor();
    const certifiedAttribute = getMockEServiceAttribute();
    descriptor.attributes = {
      certified: [[certifiedAttribute]],
      declared: [],
      verified: [],
    };
    descriptor.rejectionReasons = [
      { rejectionReason: "rejection reason", rejectedAt: new Date() },
    ];
    const templateVersionRefId = generateId();
    descriptor.templateVersionRef = { id: templateVersionRefId as any };

    await handleCatalogMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: mock.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 2,
          data: { eservice: toEServiceV2(mock) } as EServiceAddedV2,
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const payload: EServiceDescriptorAddedV2 = {
      eservice: toEServiceV2({ ...mock, descriptors: [descriptor] }),
      descriptorId: descriptor.id,
    };
    const msg: EServiceEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      type: "EServiceDescriptorAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };
    await handleCatalogMessageV2([msg], dbContext);

    const storedDescs = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor,
      { id: descriptor.id }
    );
    expect(storedDescs.length).toBe(1);
    expect(storedDescs[0].metadataVersion).toBe(2);

    const attrs = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_attribute,
      { descriptorId: descriptor.id }
    );
    expect(attrs.length).toBeGreaterThan(0);

    const reasons = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_rejection_reason,
      { descriptorId: descriptor.id }
    );
    expect(reasons.length).toBeGreaterThan(0);

    const tmplRefs = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_template_version_ref,
      { eserviceTemplateVersionId: templateVersionRefId }
    );
    expect(tmplRefs.length).toBeGreaterThan(0);
  });

  it("EServiceDescriptorDocumentAdded: inserts new document", async () => {
    const mock = getMockEService();
    const descriptor = getMockDescriptor();
    const document = getMockDocument();
    descriptor.docs = [document];

    await handleCatalogMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: mock.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 2,
          data: { eservice: toEServiceV2(mock) } as EServiceAddedV2,
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: mock.id,
          version: 2,
          type: "EServiceDescriptorAdded",
          event_version: 2,
          data: {
            eservice: toEServiceV2({
              ...mock,
              descriptors: [{ ...descriptor, docs: [] }],
            }),
            descriptorId: descriptor.id,
          } as EServiceDescriptorAddedV2,
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const payload: EServiceDescriptorDocumentAddedV2 = {
      eservice: toEServiceV2({ ...mock, descriptors: [{ ...descriptor }] }),
      descriptorId: descriptor.id,
      documentId: document.id,
    };
    const msg: EServiceEventEnvelopeV2 = {
      sequence_num: 3,
      stream_id: mock.id,
      version: 3,
      type: "EServiceDescriptorDocumentAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };
    await handleCatalogMessageV2([msg], dbContext);

    const stored = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor_document,
      { id: document.id }
    );
    expect(stored.length).toBeGreaterThan(0);
    expect(stored[0].metadataVersion).toBe(3);
  });

  it("EServiceRiskAnalysisDeleted: deletes risk analysis", async () => {
    const mock = getMockEService();
    const risk = getMockValidRiskAnalysis("PA");

    const eserviceAddedMsg: EServiceEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      type: "EServiceAdded",
      event_version: 2,
      data: {
        eservice: toEServiceV2({ ...mock, riskAnalysis: [risk] }),
      } as EServiceAddedV2,
      log_date: new Date(),
    };

    const msg: EServiceEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      type: "EServiceRiskAnalysisDeleted",
      event_version: 2,
      data: {
        riskAnalysisId: risk.id,
        eservice: toEServiceV2(mock),
      } as EServiceRiskAnalysisDeletedV2,
      log_date: new Date(),
    };
    await handleCatalogMessageV2([eserviceAddedMsg, msg], dbContext);

    const stored = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_risk_analysis,
      { id: risk.id }
    );
    expect(stored.length).toBe(0);
  });

  it("EServiceDeleted: marks eService and all subobjects deleted", async () => {
    const mock = getMockEService();
    const descriptor = getMockDescriptor();
    const document = getMockDocument();
    const risk = getMockValidRiskAnalysis("PA");

    await handleCatalogMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: mock.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 2,
          data: {
            eservice: toEServiceV2({
              ...mock,
              descriptors: [descriptor],
              riskAnalysis: [risk],
            }),
          } as EServiceAddedV2,
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: mock.id,
          version: 2,
          type: "EServiceDescriptorAdded",
          event_version: 2,
          data: {
            eservice: toEServiceV2({
              ...mock,
              descriptors: [{ ...descriptor, docs: [document] }],
            }),
            descriptorId: descriptor.id,
          } as EServiceDescriptorAddedV2,
          log_date: new Date(),
        },
        {
          sequence_num: 3,
          stream_id: mock.id,
          version: 3,
          type: "EServiceDescriptorDocumentAdded",
          event_version: 2,
          data: {
            eservice: toEServiceV2({
              ...mock,
              descriptors: [{ ...descriptor }],
            }),
            descriptorId: descriptor.id,
            documentId: document.id,
            serverUrls: [],
            document: toDocumentV2({
              ...document,
              uploadDate: new Date(),
            }),
            isInterface: false,
          } as EServiceDescriptorDocumentAddedV2,
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const msg: EServiceEventEnvelopeV2 = {
      sequence_num: 4,
      stream_id: mock.id,
      version: 4,
      type: "EServiceDeleted",
      event_version: 2,
      data: { eserviceId: mock.id } as EServiceDeletedV2,
      log_date: new Date(),
    };
    await handleCatalogMessageV2([msg], dbContext);

    const storedEservice = await getOneFromDb(
      dbContext,
      CatalogDbTable.eservice,
      { id: mock.id }
    );
    expect(storedEservice?.deleted).toBe(true);

    (
      await getManyFromDb(dbContext, CatalogDbTable.eservice_descriptor, {
        id: descriptor.id,
      })
    ).forEach((d) => expect(d.deleted).toBe(true));

    (
      await getManyFromDb(
        dbContext,
        CatalogDbTable.eservice_descriptor_document,
        { id: document.id }
      )
    ).forEach((d) => expect(d.deleted).toBe(true));

    (
      await getManyFromDb(dbContext, CatalogDbTable.eservice_risk_analysis, {
        id: risk.id,
      })
    ).forEach((r) => expect(r.deleted).toBe(true));
  });

  it.each([
    "EServicePersonalDataFlagUpdatedAfterPublication",
    "EServicePersonalDataFlagUpdatedByTemplateUpdate",
  ] as const)("%s: updates eService personalData flag", async (eventType) => {
    const publishedDescriptor: Descriptor = {
      ...getMockDescriptor(),
      audience: ["pagopa.it/test1", "pagopa.it/test2"],
      interface: getMockDocument(),
      state: descriptorState.published,
      publishedAt: new Date(),
    };

    const eService: EService = {
      ...getMockEService(),
      descriptors: [publishedDescriptor],
    };

    const eServiceAddedMsg: EServiceEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: eService.id,
      version: 1,
      type: "EServiceAdded",
      event_version: 2,
      data: { eservice: toEServiceV2(eService) } as EServiceAddedV2,
      log_date: new Date(),
    };

    const eServicePublishPayload: EServiceDescriptorPublishedV2 = {
      eservice: toEServiceV2(eService),
      descriptorId: publishedDescriptor.id,
    };
    const eServicePublishMsg: EServiceEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: eService.id,
      version: 2,
      type: "EServiceDescriptorPublished",
      event_version: 2,
      data: eServicePublishPayload,
      log_date: new Date(),
    };

    const eServiceUpdated: EService = { ...eService, personalData: true };
    const eServiceUpdateMsg: EServiceEventEnvelopeV2 = {
      sequence_num: 3,
      stream_id: eService.id,
      version: 3,
      type: eventType,
      event_version: 2,
      data: { eservice: toEServiceV2(eServiceUpdated) },
      log_date: new Date(),
    };

    await handleCatalogMessageV2(
      [eServiceAddedMsg, eServicePublishMsg, eServiceUpdateMsg],
      dbContext
    );

    const retrievedEService = await getOneFromDb(
      dbContext,
      CatalogDbTable.eservice,
      { id: eService.id }
    );

    expect(retrievedEService?.personalData).toBe(true);
    expect(retrievedEService?.metadataVersion).toBe(3);
  });
});

describe("Check on metadata_version merge", () => {
  beforeEach(async () => {
    await resetTargetTables(catalogTables);
  });

  it("should skip update when incoming metadata_version is lower or equal", async () => {
    const mock = getMockEService();

    const msgV1: EServiceEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      type: "EServiceAdded",
      event_version: 1,
      data: { eservice: toEServiceV1({ ...mock, name: "Name v1" }) },
      log_date: new Date(),
    };
    await handleCatalogMessageV1([msgV1], dbContext);

    const msgV3: EServiceEventEnvelopeV1 = {
      ...msgV1,
      type: "EServiceUpdated",
      version: 3,
      sequence_num: 2,
      data: { eservice: toEServiceV1({ ...mock, name: "Name v3" }) },
    };

    const msgV2: EServiceEventEnvelopeV1 = {
      ...msgV1,
      type: "EServiceUpdated",
      version: 2,
      sequence_num: 3,
      data: { eservice: toEServiceV1({ ...mock, name: "Name v2" }) },
    };
    await handleCatalogMessageV1([msgV3, msgV2], dbContext);

    const stored3 = await getOneFromDb(dbContext, CatalogDbTable.eservice, {
      id: mock.id,
    });
    expect(stored3?.name).toBe("Name v3");
    expect(stored3?.metadataVersion).toBe(3);
  });

  it("should apply update when incoming metadata_version is greater", async () => {
    const mock = getMockEService();

    const msgV2: EServiceEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 2,
      type: "EServiceAdded",
      event_version: 1,
      data: { eservice: toEServiceV1({ ...mock, name: "Name v2" }) },
      log_date: new Date(),
    };
    await handleCatalogMessageV1([msgV2], dbContext);

    const stored = await getOneFromDb(dbContext, CatalogDbTable.eservice, {
      id: mock.id,
    });
    expect(stored?.name).toBe("Name v2");
    expect(stored?.metadataVersion).toBe(2);
  });
  it("deletes old descriptors when new ones with higher metadataVersion are added (v2)", async () => {
    const mock = getMockEService();

    const oldDescriptors = Array.from({ length: 3 }, () => {
      const d = getMockDescriptor();
      return { ...d, metadataVersion: 1 };
    });

    const oldEserviceV2: EServiceAddedV2 = {
      eservice: toEServiceV2({
        ...mock,
        descriptors: oldDescriptors,
        riskAnalysis: [],
      }),
    };

    const msg1: EServiceEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      type: "EServiceAdded",
      event_version: 2,
      data: oldEserviceV2,
      log_date: new Date(),
    };

    const newDescriptors = [getMockDescriptor()] as any;

    const newEserviceV2: EServiceAddedV2 = {
      eservice: toEServiceV2({
        ...mock,
        descriptors: newDescriptors,
        riskAnalysis: [],
      }),
    };

    const msg2: EServiceEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: mock.id,
      version: 2,
      type: "EServiceAdded",
      event_version: 2,
      data: newEserviceV2,
      log_date: new Date(),
    };

    await handleCatalogMessageV2([msg1, msg2], dbContext);

    const storedDescriptors = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_descriptor,
      { eserviceId: mock.id }
    );

    expect(storedDescriptors.length).toBe(1);
    storedDescriptors.forEach((d) => {
      expect(d.metadataVersion).toBe(2);
    });
  });
});
