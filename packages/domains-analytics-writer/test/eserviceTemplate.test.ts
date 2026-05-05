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
  EServiceTemplateVersionInterfaceDeletedV2,
  EServiceTemplateDraftVersionDeletedV2,
  EServiceTemplateDeletedV2,
  eserviceTemplateVersionState,
  EServiceTemplateVersion,
  EServiceTemplate,
  tenantKind,
  EServiceTemplateVersionPublishedV2,
  EServiceTemplatePersonalDataFlagUpdatedAfterPublicationV2,
} from "pagopa-interop-models";
import {
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockDocument,
  getMockEServiceTemplateAttribute,
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
    const attr = getMockEServiceTemplateAttribute();
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
    expect(storedEserviceTemplate?.metadataVersion).toBe(1);

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
    expect(stored1?.name).toBe("Template v1");
    expect(stored1?.metadataVersion).toBe(1);

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
    expect(stored2?.name).toBe("Template v3");
    expect(stored2?.metadataVersion).toBe(3);

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
    expect(stored3?.name).toBe("Template v3");
    expect(stored3?.metadataVersion).toBe(3);
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
    expect(stored?.name).toBe("Template v2");
    expect(stored?.metadataVersion).toBe(2);
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
    const attr = getMockEServiceTemplateAttribute();
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
    expect(tpl?.deleted).toBe(true);

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
    const mockEServiceTemplate = getMockEServiceTemplate();
    const document = getMockDocument();
    const draftInterface = getMockDocument();
    const attribute = getMockEServiceTemplateAttribute();
    const draftEServiceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      attributes: {
        certified: [[attribute]],
        declared: [],
        verified: [],
      },
      docs: [document],
      interface: draftInterface,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [draftEServiceTemplateVersion],
    };
    const updatedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      versions: [],
    };

    const addPayload: EServiceTemplateAddedV2 = {
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    };
    const deletePayload: EServiceTemplateDraftVersionDeletedV2 = {
      eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
      eserviceTemplateVersionId: draftEServiceTemplateVersion.id,
    };

    const addMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: mockEServiceTemplate.id,
      version: 1,
      type: "EServiceTemplateAdded",
      event_version: 2,
      data: addPayload,
      log_date: new Date(),
    };
    const delMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 2,
      stream_id: mockEServiceTemplate.id,
      version: 2,
      type: "EServiceTemplateDraftVersionDeleted",
      event_version: 2,
      data: deletePayload,
      log_date: new Date(),
    };

    await handleEserviceTemplateMessageV2([addMsg, delMsg], dbContext);

    const tablesToCheck: EserviceTemplateDbTable[] = [
      EserviceTemplateDbTable.eservice_template_version,
      EserviceTemplateDbTable.eservice_template_version_interface,
      EserviceTemplateDbTable.eservice_template_version_document,
      EserviceTemplateDbTable.eservice_template_version_attribute,
    ];

    for (const table of tablesToCheck) {
      const rows = await getManyFromDb(dbContext, table, {
        eserviceTemplateId: mockEServiceTemplate.id,
      });
      expect(rows).toHaveLength(0);
    }
  });

  it("EServiceTemplateVersionInterfaceDeleted: deletes only interface", async () => {
    const mockEServiceTemplate = getMockEServiceTemplate();
    const descriptorInterface = getMockDocument();
    const draftEServiceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      interface: descriptorInterface,
    };

    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [draftEServiceTemplateVersion],
    };

    const updatedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      versions: [
        {
          ...draftEServiceTemplateVersion,
          interface: undefined,
        },
      ],
    };

    const addPayload: EServiceTemplateAddedV2 = {
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    };
    const deletePayload: EServiceTemplateVersionInterfaceDeletedV2 = {
      eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
      eserviceTemplateVersionId: draftEServiceTemplateVersion.id,
      documentId: descriptorInterface.id,
    };

    const addMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: mockEServiceTemplate.id,
      version: 1,
      type: "EServiceTemplateAdded",
      event_version: 2,
      data: addPayload,
      log_date: new Date(),
    };
    const delMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 2,
      stream_id: mockEServiceTemplate.id,
      version: 2,
      type: "EServiceTemplateVersionInterfaceDeleted",
      event_version: 2,
      data: deletePayload,
      log_date: new Date(),
    };

    await handleEserviceTemplateMessageV2([addMsg, delMsg], dbContext);

    const interfaces = await getManyFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template_version_interface,
      { id: descriptorInterface.id }
    );
    expect(interfaces).toHaveLength(0);

    const versions = await getManyFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template_version,
      { id: draftEServiceTemplateVersion.id }
    );
    expect(versions).toHaveLength(1);
  });

  it("EServiceTemplateVersionDocumentDeleted: deletes only document", async () => {
    const mockEServiceTemplate = getMockEServiceTemplate();
    const document = getMockDocument();
    const draftEServiceTemplateVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      state: eserviceTemplateVersionState.draft,
      docs: [document],
    };

    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      versions: [draftEServiceTemplateVersion],
    };
    const updatedEServiceTemplate: EServiceTemplate = {
      ...eserviceTemplate,
      versions: [
        {
          ...draftEServiceTemplateVersion,
          docs: [],
        },
      ],
    };

    const addPayload: EServiceTemplateAddedV2 = {
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    };
    const deletePayload: EServiceTemplateVersionInterfaceDeletedV2 = {
      eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
      eserviceTemplateVersionId: draftEServiceTemplateVersion.id,
      documentId: document.id,
    };

    const addMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: mockEServiceTemplate.id,
      version: 1,
      type: "EServiceTemplateAdded",
      event_version: 2,
      data: addPayload,
      log_date: new Date(),
    };
    const delMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 2,
      stream_id: mockEServiceTemplate.id,
      version: 2,
      type: "EServiceTemplateVersionDocumentDeleted",
      event_version: 2,
      data: deletePayload,
      log_date: new Date(),
    };

    await handleEserviceTemplateMessageV2([addMsg, delMsg], dbContext);

    const documents = await getManyFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template_version_document,
      { id: document.id }
    );
    expect(documents).toHaveLength(0);

    const versions = await getManyFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template_version,
      { id: draftEServiceTemplateVersion.id }
    );
    expect(versions).toHaveLength(1);
  });

  it("EServiceTemplateRiskAnalysisDeleted: deletes only riskAnalysis", async () => {
    const mockEServiceTemplate = getMockEServiceTemplate();
    const riskAnalysis = getMockValidEServiceTemplateRiskAnalysis(
      tenantKind.PA
    );

    const eserviceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      riskAnalysis: [riskAnalysis],
    };
    const updatedEServiceTemplate: EServiceTemplate = {
      ...mockEServiceTemplate,
      riskAnalysis: [],
    };

    const addPayload: EServiceTemplateAddedV2 = {
      eserviceTemplate: toEServiceTemplateV2(eserviceTemplate),
    };
    const deletePayload: EServiceTemplateRiskAnalysisDeletedV2 = {
      eserviceTemplate: toEServiceTemplateV2(updatedEServiceTemplate),
      riskAnalysisId: riskAnalysis.id,
    };

    const addMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: mockEServiceTemplate.id,
      version: 1,
      type: "EServiceTemplateAdded",
      event_version: 2,
      data: addPayload,
      log_date: new Date(),
    };
    const delMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 2,
      stream_id: mockEServiceTemplate.id,
      version: 2,
      type: "EServiceTemplateRiskAnalysisDeleted",
      event_version: 2,
      data: deletePayload,
      log_date: new Date(),
    };

    await handleEserviceTemplateMessageV2([addMsg, delMsg], dbContext);

    const retrievedRiskAnalysis = await getManyFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template_risk_analysis,
      { id: riskAnalysis.id }
    );
    expect(retrievedRiskAnalysis).toHaveLength(0);

    const retrievedRiskAnalysisAnswers = await getManyFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template_risk_analysis_answer,
      { riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id }
    );
    expect(retrievedRiskAnalysisAnswers).toHaveLength(0);
  });

  it("EServiceTemplatePersonalDataFlagUpdatedAfterPublication: updates eServiceTemplate personalData flag", async () => {
    const eServiceTemplateDraftVersion: EServiceTemplateVersion = {
      ...getMockEServiceTemplateVersion(),
      interface: getMockDocument(),
      state: eserviceTemplateVersionState.draft,
    };

    const eServiceTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      versions: [eServiceTemplateDraftVersion],
    };

    const eServiceTemplateAddPayload: EServiceTemplateAddedV2 = {
      eserviceTemplate: toEServiceTemplateV2(eServiceTemplate),
    };
    const eServiceTemplateAddMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: eServiceTemplate.id,
      version: 1,
      type: "EServiceTemplateAdded",
      event_version: 2,
      data: eServiceTemplateAddPayload,
      log_date: new Date(),
    };

    const eServiceTemplatePublishedVersion: EServiceTemplateVersion = {
      ...eServiceTemplateDraftVersion,
      publishedAt: new Date(),
      state: eserviceTemplateVersionState.published,
    };
    const eServiceTemplatePublished: EServiceTemplate = {
      ...eServiceTemplate,
      versions: [eServiceTemplatePublishedVersion],
    };
    const eServiceTemplatePublishPayload: EServiceTemplateVersionPublishedV2 = {
      eserviceTemplateVersionId: eServiceTemplatePublishedVersion.id,
      eserviceTemplate: toEServiceTemplateV2(eServiceTemplatePublished),
    };
    const eServiceTemplatePublishMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 2,
      stream_id: eServiceTemplate.id,
      version: 2,
      type: "EServiceTemplateVersionPublished",
      event_version: 2,
      data: eServiceTemplatePublishPayload,
      log_date: new Date(),
    };

    const eServiceTemplateUpdated: EServiceTemplate = {
      ...eServiceTemplatePublished,
      personalData: true,
    };
    const eServiceTemplateUpdatePayload: EServiceTemplatePersonalDataFlagUpdatedAfterPublicationV2 =
      {
        eserviceTemplate: toEServiceTemplateV2(eServiceTemplateUpdated),
      };
    const eServiceTemplateUpdateMsg: EServiceTemplateEventEnvelope = {
      sequence_num: 3,
      stream_id: eServiceTemplate.id,
      version: 3,
      type: "EServiceTemplatePersonalDataFlagUpdatedAfterPublication",
      event_version: 2,
      data: eServiceTemplateUpdatePayload,
      log_date: new Date(),
    };

    await handleEserviceTemplateMessageV2(
      [
        eServiceTemplateAddMsg,
        eServiceTemplatePublishMsg,
        eServiceTemplateUpdateMsg,
      ],
      dbContext
    );

    const retrievedEServiceTemplate = await getOneFromDb(
      dbContext,
      EserviceTemplateDbTable.eservice_template,
      { id: eServiceTemplate.id }
    );

    expect(retrievedEServiceTemplate?.personalData).toBe(true);
    expect(retrievedEServiceTemplate?.metadataVersion).toBe(3);
  });
});
