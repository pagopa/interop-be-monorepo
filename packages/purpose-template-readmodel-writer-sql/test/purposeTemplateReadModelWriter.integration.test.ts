import {
  getMockDescriptor,
  getMockEService,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test";
import { describe, expect, it } from "vitest";
import {
  dateToBigInt,
  EService,
  EServiceDescriptorPurposeTemplate,
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
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import {
  purposeTemplateReadModelService,
  purposeTemplateWriterService,
} from "./utils.js";

describe("Integration tests", async () => {
  describe("Events V2", async () => {
    const purposeTemplate = getMockPurposeTemplate();

    it("PurposeTemplateAdded", async () => {
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
      await handleMessageV2(message, purposeTemplateWriterService);

      const retrievedPurposeTemplate =
        await purposeTemplateReadModelService.getPurposeTemplateById(
          purposeTemplate.id
        );

      expect(retrievedPurposeTemplate).toStrictEqual({
        data: purposeTemplate,
        metadata: { version: metadataVersion },
      });
    });

    it("PurposeTemplateDraftUpdated", async () => {
      const metadataVersion = 1;

      await purposeTemplateWriterService.upsertPurposeTemplate(
        purposeTemplate,
        0
      );

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate,
        purposeDescription: "Updated purpose template description",
      };
      const payload: PurposeTemplateDraftUpdatedV2 = {
        purposeTemplate: toPurposeTemplateV2(updatedPurposeTemplate),
      };
      const message: PurposeTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeTemplate.id,
        version: metadataVersion,
        type: "PurposeTemplateDraftUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposeTemplateWriterService);

      const retrievedPurposeTemplate =
        await purposeTemplateReadModelService.getPurposeTemplateById(
          purposeTemplate.id
        );

      expect(retrievedPurposeTemplate).toStrictEqual({
        data: updatedPurposeTemplate,
        metadata: { version: metadataVersion },
      });
    });

    it("PurposeTemplatePublished", async () => {
      const metadataVersion = 1;

      await purposeTemplateWriterService.upsertPurposeTemplate(
        purposeTemplate,
        0
      );

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate,
        state: purposeTemplateState.active,
      };
      const payload: PurposeTemplatePublishedV2 = {
        purposeTemplate: toPurposeTemplateV2(updatedPurposeTemplate),
      };
      const message: PurposeTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeTemplate.id,
        version: metadataVersion,
        type: "PurposeTemplatePublished",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposeTemplateWriterService);

      const retrievedPurposeTemplate =
        await purposeTemplateReadModelService.getPurposeTemplateById(
          purposeTemplate.id
        );

      expect(retrievedPurposeTemplate).toStrictEqual({
        data: updatedPurposeTemplate,
        metadata: { version: metadataVersion },
      });
    });

    it("PurposeTemplateUnsuspended", async () => {
      const metadataVersion = 2;

      const suspendedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate,
        state: purposeTemplateState.suspended,
      };

      await purposeTemplateWriterService.upsertPurposeTemplate(
        suspendedPurposeTemplate,
        1
      );

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate,
        state: purposeTemplateState.active,
      };
      const payload: PurposeTemplateUnsuspendedV2 = {
        purposeTemplate: toPurposeTemplateV2(updatedPurposeTemplate),
      };
      const message: PurposeTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeTemplate.id,
        version: metadataVersion,
        type: "PurposeTemplateUnsuspended",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposeTemplateWriterService);

      const retrievedPurposeTemplate =
        await purposeTemplateReadModelService.getPurposeTemplateById(
          purposeTemplate.id
        );

      expect(retrievedPurposeTemplate).toStrictEqual({
        data: updatedPurposeTemplate,
        metadata: { version: metadataVersion },
      });
    });

    it("PurposeTemplateSuspended", async () => {
      const metadataVersion = 2;

      const activePurposeTemplate: PurposeTemplate = {
        ...purposeTemplate,
        state: purposeTemplateState.active,
      };

      await purposeTemplateWriterService.upsertPurposeTemplate(
        activePurposeTemplate,
        1
      );

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate,
        state: purposeTemplateState.suspended,
      };
      const payload: PurposeTemplateSuspendedV2 = {
        purposeTemplate: toPurposeTemplateV2(updatedPurposeTemplate),
      };
      const message: PurposeTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeTemplate.id,
        version: metadataVersion,
        type: "PurposeTemplateSuspended",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposeTemplateWriterService);

      const retrievedPurposeTemplate =
        await purposeTemplateReadModelService.getPurposeTemplateById(
          purposeTemplate.id
        );

      expect(retrievedPurposeTemplate).toStrictEqual({
        data: updatedPurposeTemplate,
        metadata: { version: metadataVersion },
      });
    });

    it("PurposeTemplateArchived", async () => {
      const metadataVersion = 2;

      const activePurposeTemplate: PurposeTemplate = {
        ...purposeTemplate,
        state: purposeTemplateState.active,
      };

      await purposeTemplateWriterService.upsertPurposeTemplate(
        activePurposeTemplate,
        1
      );

      const updatedPurposeTemplate: PurposeTemplate = {
        ...purposeTemplate,
        state: purposeTemplateState.archived,
      };
      const payload: PurposeTemplateArchivedV2 = {
        purposeTemplate: toPurposeTemplateV2(updatedPurposeTemplate),
      };
      const message: PurposeTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeTemplate.id,
        version: metadataVersion,
        type: "PurposeTemplateArchived",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposeTemplateWriterService);

      const retrievedPurposeTemplate =
        await purposeTemplateReadModelService.getPurposeTemplateById(
          purposeTemplate.id
        );

      expect(retrievedPurposeTemplate).toStrictEqual({
        data: updatedPurposeTemplate,
        metadata: { version: metadataVersion },
      });
    });

    it("PurposeTemplateDraftDeleted", async () => {
      const metadataVersion = 1;

      const otherPurposeTemplate = getMockPurposeTemplate();

      await purposeTemplateWriterService.upsertPurposeTemplate(
        purposeTemplate,
        0
      );
      await purposeTemplateWriterService.upsertPurposeTemplate(
        otherPurposeTemplate,
        0
      );

      const payload: PurposeTemplateDraftDeletedV2 = {
        purposeTemplate: toPurposeTemplateV2(purposeTemplate),
      };
      const message: PurposeTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeTemplate.id,
        version: metadataVersion,
        type: "PurposeTemplateDraftDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposeTemplateWriterService);

      const retrievedDeletedPurposeTemplate =
        await purposeTemplateReadModelService.getPurposeTemplateById(
          purposeTemplate.id
        );
      const retrievedOtherPurposeTemplate =
        await purposeTemplateReadModelService.getPurposeTemplateById(
          otherPurposeTemplate.id
        );

      expect(retrievedDeletedPurposeTemplate).toBeUndefined();
      expect(retrievedOtherPurposeTemplate).toStrictEqual({
        data: otherPurposeTemplate,
        metadata: { version: 0 },
      });
    });

    it("PurposeTemplateEServiceLinked", async () => {
      const metadataVersion = 2;
      const eservice1: EService = {
        ...getMockEService(),
        descriptors: [getMockDescriptor()],
      };
      const eservice2: EService = {
        ...getMockEService(),
        descriptors: [getMockDescriptor()],
      };
      const createdAt1 = new Date();
      const createdAt2 = new Date();

      await purposeTemplateWriterService.upsertPurposeTemplate(
        purposeTemplate,
        0
      );
      await purposeTemplateWriterService.upsertPurposeTemplateEServiceDescriptor(
        {
          purposeTemplateId: purposeTemplate.id,
          eserviceId: eservice1.id,
          descriptorId: eservice1.descriptors[0].id,
          createdAt: createdAt1,
        },
        1
      );

      const payload: PurposeTemplateEServiceLinkedV2 = {
        purposeTemplate: toPurposeTemplateV2(purposeTemplate),
        eservice: toEServiceV2(eservice2),
        descriptorId: eservice2.descriptors[0].id,
        createdAt: dateToBigInt(createdAt2),
      };
      const message: PurposeTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeTemplate.id,
        version: metadataVersion,
        type: "PurposeTemplateEServiceLinked",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposeTemplateWriterService);

      const retrievedPurposeTemplateEServiceDescriptors =
        await purposeTemplateReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateId(
          purposeTemplate.id
        );

      expect(retrievedPurposeTemplateEServiceDescriptors).toStrictEqual([
        {
          purposeTemplateId: purposeTemplate.id,
          eserviceId: eservice1.id,
          descriptorId: eservice1.descriptors[0].id,
          createdAt: createdAt1,
        },
        {
          purposeTemplateId: purposeTemplate.id,
          eserviceId: eservice2.id,
          descriptorId: eservice2.descriptors[0].id,
          createdAt: createdAt2,
        },
      ] satisfies EServiceDescriptorPurposeTemplate[]);
    });

    it("PurposeTemplateEServiceUnlinked", async () => {
      const metadataVersion = 3;
      const eservice1: EService = {
        ...getMockEService(),
        descriptors: [getMockDescriptor()],
      };
      const eservice2: EService = {
        ...getMockEService(),
        descriptors: [getMockDescriptor()],
      };
      const createdAt = new Date();
      await purposeTemplateWriterService.upsertPurposeTemplate(
        purposeTemplate,
        0
      );
      await purposeTemplateWriterService.upsertPurposeTemplateEServiceDescriptor(
        {
          purposeTemplateId: purposeTemplate.id,
          eserviceId: eservice1.id,
          descriptorId: eservice1.descriptors[0].id,
          createdAt: new Date(),
        },
        1
      );
      await purposeTemplateWriterService.upsertPurposeTemplateEServiceDescriptor(
        {
          purposeTemplateId: purposeTemplate.id,
          eserviceId: eservice2.id,
          descriptorId: eservice2.descriptors[0].id,
          createdAt,
        },
        2
      );

      const payload: PurposeTemplateEServiceUnlinkedV2 = {
        purposeTemplate: toPurposeTemplateV2(purposeTemplate),
        eservice: toEServiceV2(eservice1),
        descriptorId: eservice1.descriptors[0].id,
      };
      const message: PurposeTemplateEventEnvelope = {
        sequence_num: 1,
        stream_id: purposeTemplate.id,
        version: metadataVersion,
        type: "PurposeTemplateEServiceUnlinked",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposeTemplateWriterService);

      const retrievedPurposeTemplateEServiceDescriptors =
        await purposeTemplateReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateId(
          purposeTemplate.id
        );

      expect(retrievedPurposeTemplateEServiceDescriptors).toStrictEqual([
        {
          purposeTemplateId: purposeTemplate.id,
          eserviceId: eservice2.id,
          descriptorId: eservice2.descriptors[0].id,
          createdAt,
        } satisfies EServiceDescriptorPurposeTemplate,
      ]);
    });
  });
});
