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
    expect(storedEservice.metadataVersion).toBe(1);

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

  it("EServiceRiskAnalysisDeleted: marks riskAnalysis deleted", async () => {
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

    const stored = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_risk_analysis,
      { id: risk.id }
    );
    stored.forEach((r) => expect(r.deleted).toBe(true));
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
    expect(storedEservice.deleted).toBe(true);

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
    expect(storedEservice.metadataVersion).toBe(1);

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

  it("EServiceRiskAnalysisDeleted: marks riskAnalysis deleted", async () => {
    const mock = getMockEService();
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
            eservice: toEServiceV2({ ...mock, riskAnalysis: [risk] }),
          } as EServiceAddedV2,
          log_date: new Date(),
        },
      ],
      dbContext
    );

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
    await handleCatalogMessageV2([msg], dbContext);

    const stored = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_risk_analysis,
      { id: risk.id }
    );
    stored.forEach((r) => expect(r.deleted).toBe(true));
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
    expect(storedEservice.deleted).toBe(true);

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
    expect(stored3.name).toBe("Name v3");
    expect(stored3.metadataVersion).toBe(3);
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
    expect(stored.name).toBe("Name v2");
    expect(stored.metadataVersion).toBe(2);
  });
});
