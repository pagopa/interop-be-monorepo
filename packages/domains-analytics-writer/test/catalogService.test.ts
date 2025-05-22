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
  EService,
  Descriptor,
  EServiceTemplateVersionRef,
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
    const msg: EServiceEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: eservice.id,
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
      { id: eservice.id }
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
      { id: descriptorInterface.id }
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
      { id: riskAnalysis.id }
    );
    expect(storedRiskAnalysis.length).toBeGreaterThan(0);
  });

  it("EServiceDescriptorAdded: inserts descriptor with attributes, rejection reasons, template refs", async () => {
    const templateVersionRef: EServiceTemplateVersionRef = {
      id: generateId(),
    };
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      attributes: {
        certified: [[getMockEServiceAttribute()]],
        declared: [],
        verified: [],
      },
      rejectionReasons: [
        { rejectionReason: "rejection reason", rejectedAt: new Date() },
      ],
      templateVersionRef,
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };

    await handleCatalogMessageV1(
      [
        {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 1,
          data: { eservice: toEServiceV1(eservice) },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const payload: EServiceDescriptorAddedV1 = {
      eserviceId: eservice.id,
      eserviceDescriptor: toDescriptorV1(descriptor),
    };
    const msg: EServiceEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: eservice.id,
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
      { eserviceTemplateVersionId: templateVersionRef.id }
    );
    expect(tmplRefs.length).toBeGreaterThan(0);
  });

  it("EServiceDocumentAdded: inserts new document", async () => {
    const eservice = getMockEService();
    const descriptor = getMockDescriptor();
    const document = getMockDocument();

    await handleCatalogMessageV1(
      [
        {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 1,
          data: { eservice: toEServiceV1(eservice) },
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: eservice.id,
          version: 2,
          type: "EServiceDescriptorAdded",
          event_version: 1,
          data: {
            eserviceId: eservice.id,
            eserviceDescriptor: toDescriptorV1({ ...descriptor, docs: [] }),
          },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const payload: EServiceDocumentAddedV1 = {
      eserviceId: eservice.id,
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
      stream_id: eservice.id,
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
    const eservice = getMockEService();
    const riskAnalysis = getMockValidRiskAnalysis("PA");

    await handleCatalogMessageV1(
      [
        {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 1,
          data: {
            eservice: toEServiceV1({
              ...eservice,
              riskAnalysis: [riskAnalysis],
            }),
          },
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const msg: EServiceEventEnvelopeV1 = {
      sequence_num: 2,
      stream_id: eservice.id,
      version: 2,
      type: "EServiceRiskAnalysisDeleted",
      event_version: 1,
      data: {
        riskAnalysisId: riskAnalysis.id,
        eservice: toEServiceV1(eservice),
      } as EServiceRiskAnalysisDeletedV1,
      log_date: new Date(),
    };
    await handleCatalogMessageV1([msg], dbContext);

    const stored = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_risk_analysis,
      { id: riskAnalysis.id }
    );
    stored.forEach((r) => expect(r.deleted).toBe(true));
  });

  it("EServiceDeleted: marks eService and all subobjects deleted", async () => {
    const eservice = getMockEService();
    const descriptor = getMockDescriptor();
    const document = getMockDocument();
    const riskAnalysis = getMockValidRiskAnalysis("PA");

    await handleCatalogMessageV1(
      [
        {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 1,
          data: {
            eservice: toEServiceV1({
              ...eservice,
              descriptors: [descriptor],
              riskAnalysis: [riskAnalysis],
            }),
          },
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: eservice.id,
          version: 2,
          type: "EServiceDescriptorAdded",
          event_version: 1,
          data: {
            eserviceId: eservice.id,
            eserviceDescriptor: toDescriptorV1({
              ...descriptor,
              docs: [document],
            }),
          },
          log_date: new Date(),
        },
        {
          sequence_num: 3,
          stream_id: eservice.id,
          version: 3,
          type: "EServiceDocumentAdded",
          event_version: 1,
          data: {
            eserviceId: eservice.id,
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
      stream_id: eservice.id,
      version: 4,
      type: "EServiceDeleted",
      event_version: 1,
      data: { eserviceId: eservice.id } as EServiceDeletedV1,
      log_date: new Date(),
    };
    await handleCatalogMessageV1([msg], dbContext);

    const storedEservice = await getOneFromDb(
      dbContext,
      CatalogDbTable.eservice,
      { id: eservice.id }
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
        id: riskAnalysis.id,
      })
    ).forEach((r) => expect(r.deleted).toBe(true));
  });
});

describe("Catalog messages consumers - handleCatalogMessageV2", () => {
  beforeEach(async () => {
    await resetTargetTables(catalogTables);
  });

  it("EServiceAdded: inserts eService with descriptors, docs, interfaces, riskAnalysis", async () => {
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

    const payload: EServiceAddedV2 = {
      eservice: toEServiceV2(eservice),
    };
    const msg: EServiceEventEnvelopeV2 = {
      sequence_num: 1,
      stream_id: eservice.id,
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
      { id: eservice.id }
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
      { id: descriptorInterface.id }
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
      { id: riskAnalysis.id }
    );
    expect(storedRiskAnalysis.length).toBeGreaterThan(0);
  });

  it("EServiceDescriptorAdded: inserts descriptor with attributes, rejection reasons, template refs", async () => {
    const templateVersionRef: EServiceTemplateVersionRef = {
      id: generateId(),
    };
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      attributes: {
        certified: [[getMockEServiceAttribute()]],
        declared: [],
        verified: [],
      },
      rejectionReasons: [
        { rejectionReason: "rejection reason", rejectedAt: new Date() },
      ],
      templateVersionRef,
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };

    await handleCatalogMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 2,
          data: { eservice: toEServiceV2(eservice) } as EServiceAddedV2,
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const payload: EServiceDescriptorAddedV2 = {
      eservice: toEServiceV2({ ...eservice, descriptors: [descriptor] }),
      descriptorId: descriptor.id,
    };
    const msg: EServiceEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: eservice.id,
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
      { eserviceTemplateVersionId: templateVersionRef.id }
    );
    expect(tmplRefs.length).toBeGreaterThan(0);
  });

  it("EServiceDescriptorDocumentAdded: inserts new document", async () => {
    const eservice = getMockEService();
    const descriptor = getMockDescriptor();
    const document = getMockDocument();
    descriptor.docs = [document];

    await handleCatalogMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 2,
          data: { eservice: toEServiceV2(eservice) } as EServiceAddedV2,
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: eservice.id,
          version: 2,
          type: "EServiceDescriptorAdded",
          event_version: 2,
          data: {
            eservice: toEServiceV2({
              ...eservice,
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
      eservice: toEServiceV2({ ...eservice, descriptors: [{ ...descriptor }] }),
      descriptorId: descriptor.id,
      documentId: document.id,
    };
    const msg: EServiceEventEnvelopeV2 = {
      sequence_num: 3,
      stream_id: eservice.id,
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
    const eservice = getMockEService();
    const riskAnalysis = getMockValidRiskAnalysis("PA");

    await handleCatalogMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 2,
          data: {
            eservice: toEServiceV2({
              ...eservice,
              riskAnalysis: [riskAnalysis],
            }),
          } as EServiceAddedV2,
          log_date: new Date(),
        },
      ],
      dbContext
    );

    const msg: EServiceEventEnvelopeV2 = {
      sequence_num: 2,
      stream_id: eservice.id,
      version: 2,
      type: "EServiceRiskAnalysisDeleted",
      event_version: 2,
      data: {
        riskAnalysisId: riskAnalysis.id,
        eservice: toEServiceV2(eservice),
      } as EServiceRiskAnalysisDeletedV2,
      log_date: new Date(),
    };
    await handleCatalogMessageV2([msg], dbContext);

    const stored = await getManyFromDb(
      dbContext,
      CatalogDbTable.eservice_risk_analysis,
      { id: riskAnalysis.id }
    );
    stored.forEach((r) => expect(r.deleted).toBe(true));
  });

  it("EServiceDeleted: marks eService and all subobjects deleted", async () => {
    const eservice = getMockEService();
    const descriptor = getMockDescriptor();
    const document = getMockDocument();
    const riskAnalysis = getMockValidRiskAnalysis("PA");

    await handleCatalogMessageV2(
      [
        {
          sequence_num: 1,
          stream_id: eservice.id,
          version: 1,
          type: "EServiceAdded",
          event_version: 2,
          data: {
            eservice: toEServiceV2({
              ...eservice,
              descriptors: [descriptor],
              riskAnalysis: [riskAnalysis],
            }),
          } as EServiceAddedV2,
          log_date: new Date(),
        },
        {
          sequence_num: 2,
          stream_id: eservice.id,
          version: 2,
          type: "EServiceDescriptorAdded",
          event_version: 2,
          data: {
            eservice: toEServiceV2({
              ...eservice,
              descriptors: [{ ...descriptor, docs: [document] }],
            }),
            descriptorId: descriptor.id,
          } as EServiceDescriptorAddedV2,
          log_date: new Date(),
        },
        {
          sequence_num: 3,
          stream_id: eservice.id,
          version: 3,
          type: "EServiceDescriptorDocumentAdded",
          event_version: 2,
          data: {
            eservice: toEServiceV2({
              ...eservice,
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
      stream_id: eservice.id,
      version: 4,
      type: "EServiceDeleted",
      event_version: 2,
      data: { eserviceId: eservice.id } as EServiceDeletedV2,
      log_date: new Date(),
    };
    await handleCatalogMessageV2([msg], dbContext);

    const storedEservice = await getOneFromDb(
      dbContext,
      CatalogDbTable.eservice,
      { id: eservice.id }
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
        id: riskAnalysis.id,
      })
    ).forEach((r) => expect(r.deleted).toBe(true));
  });
});

describe("Check on metadata_version merge", () => {
  beforeEach(async () => {
    await resetTargetTables(catalogTables);
  });

  it("should skip update when incoming metadata_version is lower or equal", async () => {
    const eservice = getMockEService();

    const msgV1: EServiceEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: eservice.id,
      version: 1,
      type: "EServiceAdded",
      event_version: 1,
      data: { eservice: toEServiceV1({ ...eservice, name: "Name v1" }) },
      log_date: new Date(),
    };
    await handleCatalogMessageV1([msgV1], dbContext);

    const stored1 = await getOneFromDb(dbContext, CatalogDbTable.eservice, {
      id: eservice.id,
    });
    expect(stored1.name).toBe("Name v1");
    expect(stored1.metadataVersion).toBe(1);

    const msgV3 = {
      ...msgV1,
      version: 3,
      sequence_num: 2,
      data: { eservice: toEServiceV1({ ...eservice, name: "Name v3" }) },
    };
    await handleCatalogMessageV1([msgV3], dbContext);

    const stored2 = await getOneFromDb(dbContext, CatalogDbTable.eservice, {
      id: eservice.id,
    });
    expect(stored2.name).toBe("Name v3");
    expect(stored2.metadataVersion).toBe(3);

    const msgV2 = {
      ...msgV1,
      version: 2,
      sequence_num: 3,
      data: { eservice: toEServiceV1({ ...eservice, name: "Name v2" }) },
    };
    await handleCatalogMessageV1([msgV2], dbContext);

    const stored3 = await getOneFromDb(dbContext, CatalogDbTable.eservice, {
      id: eservice.id,
    });
    expect(stored3.name).toBe("Name v3");
    expect(stored3.metadataVersion).toBe(3);
  });

  it("should apply update when incoming metadata_version is greater", async () => {
    const eservice = getMockEService();

    const msgV2: EServiceEventEnvelopeV1 = {
      sequence_num: 1,
      stream_id: eservice.id,
      version: 2,
      type: "EServiceAdded",
      event_version: 1,
      data: { eservice: toEServiceV1({ ...eservice, name: "Name v2" }) },
      log_date: new Date(),
    };
    await handleCatalogMessageV1([msgV2], dbContext);

    const stored = await getOneFromDb(dbContext, CatalogDbTable.eservice, {
      id: eservice.id,
    });
    expect(stored.name).toBe("Name v2");
    expect(stored.metadataVersion).toBe(2);
  });
});
