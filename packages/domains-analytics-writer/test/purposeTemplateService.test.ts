/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */
import { describe, it, expect, beforeEach } from "vitest";
import {
  EService,
  missingKafkaMessageDataError,
  PurposeTemplate,
  PurposeTemplateAddedV2,
  PurposeTemplateArchivedV2,
  PurposeTemplateDraftDeletedV2,
  PurposeTemplateDraftUpdatedV2,
  PurposeTemplateEServiceLinkedV2,
  PurposeTemplateEServiceUnlinkedV2,
  PurposeTemplateEventEnvelope,
  PurposeTemplatePublishedV2,
  purposeTemplateState,
  PurposeTemplateSuspendedV2,
  PurposeTemplateUnsuspendedV2,
  toEServiceV2,
  toPurposeTemplateV2,
} from "pagopa-interop-models";
import {
  getMockDescriptor,
  getMockEService,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test";
import { handlePurposeTemplateMessageV2 } from "../src/handlers/purpose-template/consumerServiceV2.js";
import { PurposeTemplateDbTable } from "../src/model/db/index.js";
import {
  dbContext,
  getOneFromDb,
  resetTargetTables,
  purposeTemplateTables,
  getManyFromDb,
} from "./utils.js";
import { getCompleteMockPurposeTemplate } from "./utilsPurposeTemplate.js";

describe("Purpose template messages consumers - handlePurposeTemplateMessageV2", () => {
  const purposeTemplate = getMockPurposeTemplate();

  beforeEach(async () => {
    await resetTargetTables(purposeTemplateTables);
  });

  it("PurposeTemplateAdded: insert a purpose template without any related child tables", async () => {
    const metadataVersion = 0;

    const payload: PurposeTemplateAddedV2 = {
      purposeTemplate: toPurposeTemplateV2(purposeTemplate),
    };
    const message: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersion,
      type: "PurposeTemplateAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    await handlePurposeTemplateMessageV2([message], dbContext);

    const retrievedPurposeTemplate = await getOneFromDb(
      dbContext,
      PurposeTemplateDbTable.purpose_template,
      {
        id: purposeTemplate.id,
      }
    );

    expect(retrievedPurposeTemplate?.id).toBe(purposeTemplate.id);
  });

  it("PurposeTemplateAdded: insert a purpose template with all related tables", async () => {
    const metadataVersion = 0;

    const purposeTemplate = getCompleteMockPurposeTemplate();

    const payload: PurposeTemplateAddedV2 = {
      purposeTemplate: toPurposeTemplateV2(purposeTemplate),
    };
    const message: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersion,
      type: "PurposeTemplateAdded",
      event_version: 2,
      data: payload,
      log_date: new Date(),
    };

    await handlePurposeTemplateMessageV2([message], dbContext);

    const retrievedPurposeTemplate = await getOneFromDb(
      dbContext,
      PurposeTemplateDbTable.purpose_template,
      {
        id: purposeTemplate.id,
      }
    );

    expect(retrievedPurposeTemplate?.id).toBe(purposeTemplate.id);

    const retrievedPurposeTemplateRiskAnalysisForm = await getOneFromDb(
      dbContext,
      PurposeTemplateDbTable.purpose_template_risk_analysis_form,
      {
        purposeTemplateId: purposeTemplate.id,
      }
    );

    expect(retrievedPurposeTemplateRiskAnalysisForm?.purposeTemplateId).toBe(
      purposeTemplate.id
    );

    const retrievedPurposeTemplateRiskAnalysisAnswer = await getManyFromDb(
      dbContext,
      PurposeTemplateDbTable.purpose_template_risk_analysis_answer,
      {
        purposeTemplateId: purposeTemplate.id,
      }
    );

    expect(
      retrievedPurposeTemplateRiskAnalysisAnswer[0]?.purposeTemplateId
    ).toBe(purposeTemplate.id);

    const retrievedPurposeTemplateRiskAnalysisAnswerAnnotation =
      await getManyFromDb(
        dbContext,
        PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation,
        {
          purposeTemplateId: purposeTemplate.id,
        }
      );

    expect(
      retrievedPurposeTemplateRiskAnalysisAnswerAnnotation[0]?.purposeTemplateId
    ).toBe(purposeTemplate.id);

    const retrievedPurposeTemplateRiskAnalysisAnswerAnnotationDocument =
      await getManyFromDb(
        dbContext,
        PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation_document,
        {
          purposeTemplateId: purposeTemplate.id,
        }
      );

    expect(
      retrievedPurposeTemplateRiskAnalysisAnswerAnnotationDocument[0]
        ?.purposeTemplateId
    ).toBe(purposeTemplate.id);
  });

  it("PurposeTemplateAdded: should throw error when purposeTemplate is missing", async () => {
    const metadataVersion = 0;
    const message: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersion,
      type: "PurposeTemplateAdded",
      event_version: 2,
      data: {} as unknown as PurposeTemplateAddedV2,
      log_date: new Date(),
    };

    await expect(() =>
      handlePurposeTemplateMessageV2([message], dbContext)
    ).rejects.toThrow(
      missingKafkaMessageDataError("purposeTemplate", message.type)
    );
  });

  it("PurposeTemplateDraftUpdated: updates the purpose template's purposeDescription field", async () => {
    const metadataVersionAdded = 0;
    const payloadPurposeTemplateAdded: PurposeTemplateAddedV2 = {
      purposeTemplate: toPurposeTemplateV2(purposeTemplate),
    };
    const messagePurposeTemplateAdded: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersionAdded,
      type: "PurposeTemplateAdded",
      event_version: 2,
      data: payloadPurposeTemplateAdded,
      log_date: new Date(),
    };

    const metadataVersionUpdated = 1;
    const updatedPurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      purposeDescription: "Updated purpose template description",
    };
    const payloadPurposeTemplateDraftUpdated: PurposeTemplateDraftUpdatedV2 = {
      purposeTemplate: toPurposeTemplateV2(updatedPurposeTemplate),
    };
    const messagePurposeTemplateDraftUpdated: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersionUpdated,
      type: "PurposeTemplateDraftUpdated",
      event_version: 2,
      data: payloadPurposeTemplateDraftUpdated,
      log_date: new Date(),
    };
    await handlePurposeTemplateMessageV2(
      [messagePurposeTemplateAdded, messagePurposeTemplateDraftUpdated],
      dbContext
    );

    const retrievedPurposeTemplate = await getOneFromDb(
      dbContext,
      PurposeTemplateDbTable.purpose_template,
      {
        id: purposeTemplate.id,
      }
    );

    expect(retrievedPurposeTemplate?.id).toBe(purposeTemplate.id);
    expect(retrievedPurposeTemplate?.metadataVersion).toBe(
      metadataVersionUpdated
    );
    expect(retrievedPurposeTemplate?.purposeDescription).toBe(
      updatedPurposeTemplate.purposeDescription
    );
  });

  it("PurposeTemplatePublished: updates the purpose template's state to active", async () => {
    const metadataVersionAdded = 0;
    const payloadPurposeTemplateAdded: PurposeTemplateAddedV2 = {
      purposeTemplate: toPurposeTemplateV2(purposeTemplate),
    };
    const messagePurposeTemplateAdded: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersionAdded,
      type: "PurposeTemplateAdded",
      event_version: 2,
      data: payloadPurposeTemplateAdded,
      log_date: new Date(),
    };

    const metadataVersionUpdated = 1;
    const updatedPurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      state: purposeTemplateState.active,
    };
    const payloadPurposeTemplateDraftUpdated: PurposeTemplateDraftUpdatedV2 = {
      purposeTemplate: toPurposeTemplateV2(updatedPurposeTemplate),
    };
    const messagePurposeTemplateDraftUpdated: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersionUpdated,
      type: "PurposeTemplateDraftUpdated",
      event_version: 2,
      data: payloadPurposeTemplateDraftUpdated,
      log_date: new Date(),
    };
    await handlePurposeTemplateMessageV2(
      [messagePurposeTemplateAdded, messagePurposeTemplateDraftUpdated],
      dbContext
    );

    const retrievedPurposeTemplate = await getOneFromDb(
      dbContext,
      PurposeTemplateDbTable.purpose_template,
      {
        id: purposeTemplate.id,
      }
    );

    expect(retrievedPurposeTemplate?.id).toBe(purposeTemplate.id);
    expect(retrievedPurposeTemplate?.metadataVersion).toBe(
      metadataVersionUpdated
    );
    expect(retrievedPurposeTemplate?.state).toBe(purposeTemplateState.active);
  });

  it("PurposeTemplateUnsuspended: updates the purpose template's state from suspended to active", async () => {
    const metadataVersionSuspended = 2;
    const suspendedPurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      state: purposeTemplateState.suspended,
    };
    const payloadPurposeTemplateSuspended: PurposeTemplateSuspendedV2 = {
      purposeTemplate: toPurposeTemplateV2(suspendedPurposeTemplate),
    };
    const messagePurposeTemplateSuspended: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersionSuspended,
      type: "PurposeTemplateSuspended",
      event_version: 2,
      data: payloadPurposeTemplateSuspended,
      log_date: new Date(),
    };

    const metadataVersionUnsuspended = 3;
    const unsuspendedPurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      state: purposeTemplateState.active,
    };
    const payloadPurposeTemplateUnsuspended: PurposeTemplateUnsuspendedV2 = {
      purposeTemplate: toPurposeTemplateV2(unsuspendedPurposeTemplate),
    };
    const messagePurposeTemplateUnsuspended: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersionUnsuspended,
      type: "PurposeTemplateUnsuspended",
      event_version: 2,
      data: payloadPurposeTemplateUnsuspended,
      log_date: new Date(),
    };
    await handlePurposeTemplateMessageV2(
      [messagePurposeTemplateSuspended, messagePurposeTemplateUnsuspended],
      dbContext
    );

    const retrievedPurposeTemplate = await getOneFromDb(
      dbContext,
      PurposeTemplateDbTable.purpose_template,
      {
        id: purposeTemplate.id,
      }
    );

    expect(retrievedPurposeTemplate?.id).toBe(purposeTemplate.id);
    expect(retrievedPurposeTemplate?.metadataVersion).toBe(
      metadataVersionUnsuspended
    );
    expect(retrievedPurposeTemplate?.state).toBe(purposeTemplateState.active);
  });

  it("PurposeTemplateSuspended: updates the purpose template's state from active to suspended", async () => {
    const metadataVersionActive = 2;
    const activePurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      state: purposeTemplateState.active,
    };
    const payloadPurposeTemplateActive: PurposeTemplatePublishedV2 = {
      purposeTemplate: toPurposeTemplateV2(activePurposeTemplate),
    };
    const messagePurposeTemplateActive: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersionActive,
      type: "PurposeTemplatePublished",
      event_version: 2,
      data: payloadPurposeTemplateActive,
      log_date: new Date(),
    };

    const metadataVersionSuspended = 3;
    const unsuspendedPurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      state: purposeTemplateState.suspended,
    };
    const payloadPurposeTemplateSuspended: PurposeTemplateSuspendedV2 = {
      purposeTemplate: toPurposeTemplateV2(unsuspendedPurposeTemplate),
    };
    const messagePurposeTemplateSuspended: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersionSuspended,
      type: "PurposeTemplateSuspended",
      event_version: 2,
      data: payloadPurposeTemplateSuspended,
      log_date: new Date(),
    };
    await handlePurposeTemplateMessageV2(
      [messagePurposeTemplateActive, messagePurposeTemplateSuspended],
      dbContext
    );

    const retrievedPurposeTemplate = await getOneFromDb(
      dbContext,
      PurposeTemplateDbTable.purpose_template,
      {
        id: purposeTemplate.id,
      }
    );

    expect(retrievedPurposeTemplate?.id).toBe(purposeTemplate.id);
    expect(retrievedPurposeTemplate?.metadataVersion).toBe(
      metadataVersionSuspended
    );
    expect(retrievedPurposeTemplate?.state).toBe(
      purposeTemplateState.suspended
    );
  });

  it("PurposeTemplateArchived: updates the purpose template's state from active to archived", async () => {
    const metadataVersionActive = 2;
    const activePurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      state: purposeTemplateState.active,
    };
    const payloadPurposeTemplateActive: PurposeTemplatePublishedV2 = {
      purposeTemplate: toPurposeTemplateV2(activePurposeTemplate),
    };
    const messagePurposeTemplateActive: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersionActive,
      type: "PurposeTemplatePublished",
      event_version: 2,
      data: payloadPurposeTemplateActive,
      log_date: new Date(),
    };

    const metadataVersionArchived = 3;
    const archivedPurposeTemplate: PurposeTemplate = {
      ...purposeTemplate,
      state: purposeTemplateState.archived,
    };
    const payloadPurposeTemplateArchived: PurposeTemplateArchivedV2 = {
      purposeTemplate: toPurposeTemplateV2(archivedPurposeTemplate),
    };
    const messagePurposeTemplateArchived: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersionArchived,
      type: "PurposeTemplateArchived",
      event_version: 2,
      data: payloadPurposeTemplateArchived,
      log_date: new Date(),
    };
    await handlePurposeTemplateMessageV2(
      [messagePurposeTemplateActive, messagePurposeTemplateArchived],
      dbContext
    );

    const retrievedPurposeTemplate = await getOneFromDb(
      dbContext,
      PurposeTemplateDbTable.purpose_template,
      {
        id: purposeTemplate.id,
      }
    );

    expect(retrievedPurposeTemplate?.id).toBe(purposeTemplate.id);
    expect(retrievedPurposeTemplate?.metadataVersion).toBe(
      metadataVersionArchived
    );
    expect(retrievedPurposeTemplate?.state).toBe(purposeTemplateState.archived);
  });

  it("PurposeTemplateDraftDeleted: marks a purpose template and its related tables as deleted", async () => {
    const metadataVersionAdded = 0;
    const payloadPurposeTemplateAdded: PurposeTemplateAddedV2 = {
      purposeTemplate: toPurposeTemplateV2(purposeTemplate),
    };
    const messagePurposeTemplateAdded: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersionAdded,
      type: "PurposeTemplateAdded",
      event_version: 2,
      data: payloadPurposeTemplateAdded,
      log_date: new Date(),
    };

    const metadataVersionPurposeTemplateDraftDeleted = 1;

    const payloadPurposeTemplateDraftDeleted: PurposeTemplateDraftDeletedV2 = {
      purposeTemplate: toPurposeTemplateV2(purposeTemplate),
    };
    const messagePurposeTemplateDraftDeleted: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersionPurposeTemplateDraftDeleted,
      type: "PurposeTemplateDraftDeleted",
      event_version: 2,
      data: payloadPurposeTemplateDraftDeleted,
      log_date: new Date(),
    };

    await handlePurposeTemplateMessageV2(
      [messagePurposeTemplateAdded, messagePurposeTemplateDraftDeleted],
      dbContext
    );

    const purposeTemplateId = purposeTemplate.id;

    const checks = [
      {
        table: PurposeTemplateDbTable.purpose_template,
        where: { id: purposeTemplateId },
      },
      {
        table: PurposeTemplateDbTable.purpose_template_eservice_descriptor,
        where: { purposeTemplateId },
      },
      {
        table: PurposeTemplateDbTable.purpose_template_risk_analysis_form,
        where: { purposeTemplateId },
      },
      {
        table: PurposeTemplateDbTable.purpose_template_risk_analysis_answer,
        where: { purposeTemplateId },
      },
      {
        table:
          PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation,
        where: { purposeTemplateId },
      },
      {
        table:
          PurposeTemplateDbTable.purpose_template_risk_analysis_answer_annotation_document,
        where: { purposeTemplateId },
      },
    ];

    for (const { table, where } of checks) {
      const rows = await getManyFromDb(dbContext, table, where);
      rows.forEach((r) => expect(r.deleted).toBe(true));
    }
  });

  it("PurposeTemplateEServiceLinked: insert purpose template linked EService descriptor", async () => {
    const metadataVersionPurposeTemplateAdded = 0;
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [getMockDescriptor()],
    };

    const payloadPurposeTemplateAdded: PurposeTemplateAddedV2 = {
      purposeTemplate: toPurposeTemplateV2(purposeTemplate),
    };
    const messagePurposeTemplateAdded: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersionPurposeTemplateAdded,
      type: "PurposeTemplateAdded",
      event_version: 2,
      data: payloadPurposeTemplateAdded,
      log_date: new Date(),
    };

    const metadataPurposeTemplateEServiceLinked = 1;
    const payloadPurposeTemplateEServiceLinked: PurposeTemplateEServiceLinkedV2 =
      {
        purposeTemplate: toPurposeTemplateV2(purposeTemplate),
        eservice: toEServiceV2(eservice),
        descriptorId: eservice.descriptors[0].id,
        createdAt: BigInt(Date.now()),
      };
    const messagePurposeTemplateEServiceLinked: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataPurposeTemplateEServiceLinked,
      type: "PurposeTemplateEServiceLinked",
      event_version: 2,
      data: payloadPurposeTemplateEServiceLinked,
      log_date: new Date(),
    };

    await handlePurposeTemplateMessageV2(
      [messagePurposeTemplateAdded, messagePurposeTemplateEServiceLinked],
      dbContext
    );

    const retrievedPurposeTemplateEServiceDescriptors = await getOneFromDb(
      dbContext,
      PurposeTemplateDbTable.purpose_template_eservice_descriptor,
      {
        purposeTemplateId: purposeTemplate.id,
      }
    );

    expect(retrievedPurposeTemplateEServiceDescriptors?.purposeTemplateId).toBe(
      purposeTemplate.id
    );
  });

  it("PurposeTemplateEServiceUnlinked:  marks a purpose template linked EService descriptor as deleted", async () => {
    const metadataVersionPurposeTemplateAdded = 0;
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [getMockDescriptor()],
    };

    const payloadPurposeTemplateAdded: PurposeTemplateAddedV2 = {
      purposeTemplate: toPurposeTemplateV2(purposeTemplate),
    };
    const messagePurposeTemplateAdded: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataVersionPurposeTemplateAdded,
      type: "PurposeTemplateAdded",
      event_version: 2,
      data: payloadPurposeTemplateAdded,
      log_date: new Date(),
    };

    const metadataPurposeTemplateEServiceLinked = 1;
    const payloadPurposeTemplateEServiceLinked: PurposeTemplateEServiceLinkedV2 =
      {
        purposeTemplate: toPurposeTemplateV2(purposeTemplate),
        eservice: toEServiceV2(eservice),
        descriptorId: eservice.descriptors[0].id,
        createdAt: BigInt(Date.now()),
      };
    const messagePurposeTemplateEServiceLinked: PurposeTemplateEventEnvelope = {
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: metadataPurposeTemplateEServiceLinked,
      type: "PurposeTemplateEServiceLinked",
      event_version: 2,
      data: payloadPurposeTemplateEServiceLinked,
      log_date: new Date(),
    };

    const metadataPurposeTemplateEServiceUnlinked = 2;
    const payloadPurposeTemplateEServiceUnlinked: PurposeTemplateEServiceUnlinkedV2 =
      {
        purposeTemplate: toPurposeTemplateV2(purposeTemplate),
        eservice: toEServiceV2(eservice),
        descriptorId: eservice.descriptors[0].id,
      };
    const messagePurposeTemplateEServiceUnlinked: PurposeTemplateEventEnvelope =
      {
        sequence_num: 1,
        stream_id: purposeTemplate.id,
        version: metadataPurposeTemplateEServiceUnlinked,
        type: "PurposeTemplateEServiceUnlinked",
        event_version: 2,
        data: payloadPurposeTemplateEServiceUnlinked,
        log_date: new Date(),
      };

    await handlePurposeTemplateMessageV2(
      [
        messagePurposeTemplateAdded,
        messagePurposeTemplateEServiceLinked,
        messagePurposeTemplateEServiceUnlinked,
      ],
      dbContext
    );

    const retrievedPurposeTemplateEServiceDescriptors = await getOneFromDb(
      dbContext,
      PurposeTemplateDbTable.purpose_template_eservice_descriptor,
      {
        purposeTemplateId: purposeTemplate.id,
      }
    );

    expect(retrievedPurposeTemplateEServiceDescriptors?.purposeTemplateId).toBe(
      purposeTemplate.id
    );
    expect(retrievedPurposeTemplateEServiceDescriptors?.deleted).toBe(true);
  });
});
