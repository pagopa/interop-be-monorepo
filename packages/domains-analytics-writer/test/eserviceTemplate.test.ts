/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */
import { describe, it, expect, beforeEach } from "vitest";
import {
  EServiceTemplateAddedV2,
  EServiceTemplateEventEnvelope,
  toEServiceTemplateV2,
  generateId,
  EServiceTemplateRiskAnalysisDeletedV2,
  EServiceTemplateVersionDocumentDeletedV2,
  EServiceTemplateVersionInterfaceDeletedV2,
  EServiceTemplateDraftVersionDeletedV2,
  EServiceTemplateDeletedV2,
  tenantKind,
} from "pagopa-interop-models";
import {
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockDocument,
  getMockEServiceAttribute,
  getMockValidEServiceTemplateRiskAnalysis,
} from "pagopa-interop-commons-test";
import { EserviceTemplateDbTable } from "../src/model/db/index.js";
import { handleEserviceTemplateMessageV2 } from "../src/handlers/eservice-template/consumerServiceV2.js";
import {
  dbContext,
  getOneFromDb,
  getManyFromDb,
  eserviceTemplateTables,
  resetTargetTables,
} from "./utils.js";

describe("Template messages consumers - handleEserviceTemplateMessageV2", () => {
  beforeEach(async () => {
    await resetTargetTables(eserviceTemplateTables);
  });

  it("EServiceTemplateAdded: populates all tables", async () => {
    const template = getMockEServiceTemplate();
    const version = getMockEServiceTemplateVersion();

    version.interface = {
      id: generateId(),
      name: "iface",
      prettyName: "Interface",
      contentType: "application/json",
      path: "/v1",
      checksum: "abc",
      uploadDate: new Date(),
    };
    const doc = getMockDocument();
    version.docs = [doc];
    const attr = getMockEServiceAttribute();
    version.attributes = { certified: [[attr]], declared: [], verified: [] };
    const risk = getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA);
    template.riskAnalysis = [risk];
    template.versions = [version];
    const payload: EServiceTemplateAddedV2 = {
      eserviceTemplate: toEServiceTemplateV2(template),
    };
    const msg: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: template.id,
      version: 1,
      type: "EServiceTemplateAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    await handleEserviceTemplateMessageV2([msg], dbContext);

    const storedEserviceTemplate = await getOneFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template,
      { id: template.id }
    );
    expect(storedEserviceTemplate).toBeDefined();
    expect(storedEserviceTemplate.metadataVersion).toBe(1);

    const storedVersions = await getManyFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template_version,
      { id: version.id }
    );
    for (const version of storedVersions) {
      expect(version).toBeDefined();

      const storedDocuments = await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version_document,
        { versionId: version.id }
      );
      expect(storedDocuments.length).toBe(1);

      const storedAttribute = await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version_attribute,
        { attributeId: attr.id }
      );
      expect(storedAttribute.length).toBe(1);
    }

    const storedInterface = await getManyFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template_version_interface,
      { id: version.interface.id }
    );
    expect(storedInterface.length).toBeDefined();

    const storedRiskAnalysis = await getManyFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template_risk_analysis,
      { id: risk.id }
    );
    expect(storedRiskAnalysis.length).toBe(1);

    for (const riskAnalysis of storedRiskAnalysis) {
      const storedRiskAnwer = await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_risk_analysis_answer,
        { riskAnalysisFormId: riskAnalysis.riskAnalysisFormId }
      );
      expect(storedRiskAnwer.length).toBeGreaterThan(0);
    }
  });

  it("EServiceTemplateAdded: throws error when message has no eserviceTemplate", async () => {
    const msg: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: "some-id",
      version: 1,
      type: "EServiceTemplateAdded",
      event_version: 2,
      data: { eserviceTemplate: undefined as any },
      log_date: new Date(),
    };

    await expect(
      handleEserviceTemplateMessageV2([msg], dbContext)
    ).rejects.toThrowError(
      "eserviceTemplate can't be missing in the event message"
    );
  });

  it("EServiceTemplateAdded: should skip update when incoming metadata_version is lower or equal", async () => {
    const mock = getMockEServiceTemplate();
    const templateV1 = toEServiceTemplateV2({ ...mock, name: "Template v1" });

    const msgV1: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 1,
      type: "EServiceTemplateAdded",
      event_version: 2,
      data: { eserviceTemplate: templateV1 },
      log_date: new Date(),
    };

    await handleEserviceTemplateMessageV2([msgV1], dbContext);
    const stored1 = await getOneFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template,
      {
        id: mock.id,
      }
    );
    expect(stored1.name).toBe("Template v1");
    expect(stored1.metadataVersion).toBe(1);

    const templateV3 = toEServiceTemplateV2({ ...mock, name: "Template v3" });
    const msgV3 = {
      ...msgV1,
      version: 3,
      sequence_num: 2,
      data: { eserviceTemplate: templateV3 },
    };
    await handleEserviceTemplateMessageV2([msgV3], dbContext);
    const stored2 = await getOneFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template,
      {
        id: mock.id,
      }
    );
    expect(stored2.name).toBe("Template v3");
    expect(stored2.metadataVersion).toBe(3);

    const templateV2 = toEServiceTemplateV2({ ...mock, name: "Template v2" });
    const msgV2 = {
      ...msgV1,
      version: 2,
      sequence_num: 3,
      data: { eserviceTemplate: templateV2 },
    };
    await handleEserviceTemplateMessageV2([msgV2], dbContext);
    const stored3 = await getOneFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template,
      {
        id: mock.id,
      }
    );
    expect(stored3.name).toBe("Template v3");
    expect(stored3.metadataVersion).toBe(3);
  });

  it("EServiceTemplateAdded: should apply update when incoming metadata_version is greater", async () => {
    const mock = getMockEServiceTemplate();

    const templateV2 = toEServiceTemplateV2({ ...mock, name: "Template v2" });
    const msgV2: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: mock.id,
      version: 2,
      type: "EServiceTemplateAdded",
      event_version: 2,
      data: { eserviceTemplate: templateV2 },
      log_date: new Date(),
    };
    await handleEserviceTemplateMessageV2([msgV2], dbContext);

    const stored = await getOneFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template,
      {
        id: mock.id,
      }
    );
    expect(stored.name).toBe("Template v2");
    expect(stored.metadataVersion).toBe(2);
  });

  it("EServiceTemplateDeleted: cascades delete to all nested tables", async () => {
    const template = getMockEServiceTemplate();
    const version = getMockEServiceTemplateVersion();
    version.interface = {
      id: generateId(),
      name: "iface",
      prettyName: "Interface",
      contentType: "application/json",
      path: "/v1",
      checksum: "abc",
      uploadDate: new Date(),
    };
    const doc = getMockDocument();
    version.docs = [doc];
    const attr = getMockEServiceAttribute();
    version.attributes = { certified: [[attr]], declared: [], verified: [] };
    const risk = getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA);

    template.versions = [version];
    template.riskAnalysis = [risk];

    const addMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: template.id,
      version: 1,
      type: "EServiceTemplateAdded",
      event_version: 2,
      data: { eserviceTemplate: toEServiceTemplateV2(template) },
      log_date: new Date(),
    };

    const delMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 2,
      stream_id: template.id,
      version: 2,
      type: "EServiceTemplateDeleted",
      event_version: 2,
      data: {
        eserviceTemplate: toEServiceTemplateV2(template),
      } as EServiceTemplateDeletedV2,
      log_date: new Date(),
    };

    await handleEserviceTemplateMessageV2([addMsg, delMsg], dbContext);

    const tpl = await getOneFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template,
      { id: template.id }
    );
    expect(tpl.deleted).toBe(true);

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version,
        { eserviceTemplateId: template.id }
      )
    ).forEach((r) => expect(r.deleted).toBe(true));

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version_interface,
        { id: version.interface.id }
      )
    ).forEach((r) => expect(r.deleted).toBe(true));

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version_document,
        { versionId: version.id }
      )
    ).forEach((r) => expect(r.deleted).toBe(true));

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version_attribute,
        { attributeId: attr.id }
      )
    ).forEach((r) => expect(r.deleted).toBe(true));

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_risk_analysis,
        { id: risk.id }
      )
    ).forEach((r) => expect(r.deleted).toBe(true));

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_risk_analysis_answer,
        { riskAnalysisFormId: risk.riskAnalysisForm.id }
      )
    ).forEach((r) => expect(r.deleted).toBe(true));
  });

  it("EServiceTemplateDeleted: throws error when message has no eserviceTemplate", async () => {
    const msg: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: "some-id",
      version: 1,
      type: "EServiceTemplateDeleted",
      event_version: 2,
      data: { eserviceTemplate: undefined as any },
      log_date: new Date(),
    };

    await expect(
      handleEserviceTemplateMessageV2([msg], dbContext)
    ).rejects.toThrowError(
      "eserviceTemplate can't be missing in the event message"
    );
  });

  it("EServiceTemplateDraftVersionDeleted: deletes version and its sub-objects", async () => {
    const template = getMockEServiceTemplate();
    const version = getMockEServiceTemplateVersion();
    version.interface = {
      id: generateId(),
      name: "",
      prettyName: "",
      contentType: "",
      path: "",
      checksum: "",
      uploadDate: new Date(),
    };
    const doc = getMockDocument();
    version.docs = [doc];
    const attr = getMockEServiceAttribute();
    version.attributes = { certified: [[attr]], declared: [], verified: [] };
    const risk = getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA);

    template.versions = [version];
    template.riskAnalysis = [risk];

    const addMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: template.id,
      version: 1,
      type: "EServiceTemplateAdded",
      event_version: 2,
      data: { eserviceTemplate: toEServiceTemplateV2(template) },
      log_date: new Date(),
    };
    const delMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 2,
      stream_id: template.id,
      version: 2,
      type: "EServiceTemplateDraftVersionDeleted",
      event_version: 2,
      data: {
        eserviceTemplateVersionId: version.id,
      } as EServiceTemplateDraftVersionDeletedV2,
      log_date: new Date(),
    };

    await handleEserviceTemplateMessageV2([addMsg, delMsg], dbContext);

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version,
        { id: version.id }
      )
    ).forEach((r) => expect(r.deleted).toBe(true));
    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version_interface,
        { id: version.interface.id }
      )
    ).forEach((r) => expect(r.deleted).toBe(true));

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version_document,
        { versionId: version.id }
      )
    ).forEach((r) => expect(r.deleted).toBe(true));

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version_attribute,
        { attributeId: attr.id }
      )
    ).forEach((r) => expect(r.deleted).toBe(true));

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_risk_analysis,
        { id: risk.id }
      )
    ).forEach((r) => expect(r.deleted).not.toBe(true));
  });

  it("EServiceTemplateVersionInterfaceDeleted: deletes only interface", async () => {
    const template = getMockEServiceTemplate();
    const version = getMockEServiceTemplateVersion();
    const ifaceId = generateId();
    version.interface = {
      id: ifaceId as any,
      name: "",
      prettyName: "",
      contentType: "",
      path: "",
      checksum: "",
      uploadDate: new Date(),
    };
    template.versions = [version];

    const addMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: template.id,
      version: 1,
      type: "EServiceTemplateAdded",
      event_version: 2,
      data: { eserviceTemplate: toEServiceTemplateV2(template) },
      log_date: new Date(),
    };
    const delMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 2,
      stream_id: template.id,
      version: 2,
      type: "EServiceTemplateVersionInterfaceDeleted",
      event_version: 2,
      data: {
        eserviceTemplateVersionId: version.id as any,
        eserviceTemplate: toEServiceTemplateV2(template),
      } as EServiceTemplateVersionInterfaceDeletedV2,
      log_date: new Date(),
    };

    await handleEserviceTemplateMessageV2([addMsg, delMsg], dbContext);

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version_interface,
        { id: ifaceId }
      )
    ).forEach((r) => expect(r.deleted).toBe(true));

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version,
        { id: version.id }
      )
    ).forEach((r) => expect(r.deleted).not.toBe(true));
  });

  it("EServiceTemplateVersionInterfaceDeleted: throws error when version is not found", async () => {
    const template = getMockEServiceTemplate();

    const msg = {
      sequence_num: 1,
      stream_id: template.id,
      version: 1,
      type: "EServiceTemplateVersionInterfaceDeleted",
      event_version: 2,
      data: {
        eserviceTemplateVersionId: "non-existing-version-id",
        eserviceTemplate: toEServiceTemplateV2(template),
      },
      log_date: new Date(),
    } as any;

    await expect(
      handleEserviceTemplateMessageV2([msg], dbContext)
    ).rejects.toThrowError(
      "Version not found for versionId: non-existing-version-id"
    );
  });

  it("EServiceTemplateVersionInterfaceDeleted: throws error when interface is missing", async () => {
    const template = getMockEServiceTemplate();
    const version = getMockEServiceTemplateVersion();
    version.interface = undefined;
    template.versions = [version];

    const msg = {
      sequence_num: 1,
      stream_id: template.id,
      version: 1,
      type: "EServiceTemplateVersionInterfaceDeleted",
      event_version: 2,
      data: {
        eserviceTemplateVersionId: version.id,
        eserviceTemplate: toEServiceTemplateV2(template),
      },
      log_date: new Date(),
    } as any;

    await expect(
      handleEserviceTemplateMessageV2([msg], dbContext)
    ).rejects.toThrowError(
      `Missing interface for the specified version id: ${version.id}`
    );
  });

  it("EServiceTemplateVersionDocumentDeleted: deletes only document", async () => {
    const template = getMockEServiceTemplate();
    const version = getMockEServiceTemplateVersion();
    const doc = getMockDocument();
    version.docs = [doc];
    template.versions = [version];

    const addMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: template.id,
      version: 1,
      type: "EServiceTemplateAdded",
      event_version: 2,
      data: { eserviceTemplate: toEServiceTemplateV2(template) },
      log_date: new Date(),
    };
    const delMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 2,
      stream_id: template.id,
      version: 2,
      type: "EServiceTemplateVersionDocumentDeleted",
      event_version: 2,
      data: {
        documentId: doc.id as any,
      } as EServiceTemplateVersionDocumentDeletedV2,
      log_date: new Date(),
    };

    await handleEserviceTemplateMessageV2([addMsg, delMsg], dbContext);

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_version_document,
        { id: doc.id }
      )
    ).forEach((r) => expect(r.deleted).toBe(true));
  });

  it("EServiceTemplateRiskAnalysisDeleted: deletes only riskAnalysis", async () => {
    const template = getMockEServiceTemplate();
    const risk = getMockValidEServiceTemplateRiskAnalysis(tenantKind.PA);
    template.riskAnalysis = [risk];

    const addMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: template.id,
      version: 1,
      type: "EServiceTemplateAdded",
      event_version: 2,
      data: { eserviceTemplate: toEServiceTemplateV2(template) },
      log_date: new Date(),
    };
    const delMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 2,
      stream_id: template.id,
      version: 2,
      type: "EServiceTemplateRiskAnalysisDeleted",
      event_version: 2,
      data: {
        riskAnalysisId: risk.id,
      } as EServiceTemplateRiskAnalysisDeletedV2,
      log_date: new Date(),
    };

    await handleEserviceTemplateMessageV2([addMsg, delMsg], dbContext);

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_risk_analysis,
        { id: risk.id }
      )
    ).forEach((r) => expect(r.deleted).toBe(true));

    (
      await getManyFromDb(
        dbContext,
        EserviceTemplateDbTable.eservice_template_risk_analysis_answer,
        { riskAnalysisFormId: risk.riskAnalysisForm.id }
      )
    ).forEach((r) => expect(r.deleted).not.toBe(true));
  });
});
