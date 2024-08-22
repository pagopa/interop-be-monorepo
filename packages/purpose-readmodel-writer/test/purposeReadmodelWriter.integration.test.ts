import { describe, expect, it } from "vitest";
import {
  getMockPurpose,
  getMockPurposeVersion,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  DraftPurposeDeletedV2,
  DraftPurposeUpdatedV2,
  NewPurposeVersionActivatedV2,
  NewPurposeVersionWaitingForApprovalV2,
  Purpose,
  PurposeActivatedV2,
  PurposeAddedV2,
  PurposeArchivedV2,
  PurposeClonedV2,
  PurposeCreatedV1,
  PurposeDeletedV1,
  PurposeEventEnvelope,
  PurposeUpdatedV1,
  PurposeVersion,
  PurposeVersionActivatedV1,
  PurposeVersionActivatedV2,
  PurposeVersionArchivedV1,
  PurposeVersionCreatedV1,
  PurposeVersionDeletedV1,
  PurposeVersionOverQuotaUnsuspendedV2,
  PurposeVersionRejectedV1,
  PurposeVersionRejectedV2,
  PurposeVersionSuspendedByConsumerV2,
  PurposeVersionSuspendedByProducerV2,
  PurposeVersionSuspendedV1,
  PurposeVersionUnsuspendedByConsumerV2,
  PurposeVersionUnsuspendedByProducerV2,
  PurposeVersionUpdatedV1,
  PurposeVersionWaitedForApprovalV1,
  PurposeWaitingForApprovalV2,
  WaitingForApprovalPurposeVersionDeletedV2,
  generateId,
  purposeVersionState,
  toPurposeV2,
  toReadModelPurpose,
} from "pagopa-interop-models";
import { handleMessageV1 } from "../src/purposeConsumerServiceV1.js";
import { handleMessageV2 } from "../src/purposeConsumerServiceV2.js";
import { toPurposeV1, toPurposeVersionV1 } from "./protobufConverterToV1.js";
import { purposes } from "./utils.js";

describe("Integration tests", async () => {
  describe("Events V1", () => {
    const mockPurpose = getMockPurpose();
    const mockPurposeVersion = getMockPurposeVersion();

    it("PurposeCreated", async () => {
      const payload: PurposeCreatedV1 = {
        purpose: toPurposeV1(mockPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 1,
        type: "PurposeCreated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(toReadModelPurpose(mockPurpose));
      expect(retrievedPurpose?.metadata).toEqual({ version: 1 });
    });

    it("PurposeVersionCreated", async () => {
      await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion],
      };
      const payload: PurposeVersionCreatedV1 = {
        purposeId: mockPurpose.id,
        version: toPurposeVersionV1(mockPurposeVersion),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 2,
        type: "PurposeVersionCreated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeUpdated", async () => {
      await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes, 1);

      const updatedPurpose = {
        ...mockPurpose,
        description: "Updated description",
      };
      const payload: PurposeUpdatedV1 = {
        purpose: toPurposeV1(updatedPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 2,
        type: "PurposeUpdated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeVersionActivated", async () => {
      const purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion],
      };
      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...mockPurpose,
        versions: [
          { ...mockPurposeVersion, state: purposeVersionState.active },
        ],
      };
      const payload: PurposeVersionActivatedV1 = {
        purpose: toPurposeV1(updatedPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 2,
        type: "PurposeVersionActivated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeVersionSuspended", async () => {
      const purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion],
      };
      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...mockPurpose,
        versions: [
          { ...mockPurposeVersion, state: purposeVersionState.suspended },
        ],
      };
      const payload: PurposeVersionSuspendedV1 = {
        purpose: toPurposeV1(updatedPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 2,
        type: "PurposeVersionSuspended",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeVersionArchived", async () => {
      const purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion],
      };
      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...mockPurpose,
        versions: [
          { ...mockPurposeVersion, state: purposeVersionState.archived },
        ],
      };
      const payload: PurposeVersionArchivedV1 = {
        purpose: toPurposeV1(updatedPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 2,
        type: "PurposeVersionArchived",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeVersionWaitedForApproval", async () => {
      const purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion],
      };
      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...mockPurpose,
        versions: [
          {
            ...mockPurposeVersion,
            state: purposeVersionState.waitingForApproval,
          },
        ],
      };
      const payload: PurposeVersionWaitedForApprovalV1 = {
        purpose: toPurposeV1(updatedPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 2,
        type: "PurposeVersionWaitedForApproval",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeVersionRejected", async () => {
      const purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion],
      };
      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...mockPurpose,
        versions: [
          {
            ...mockPurposeVersion,
            state: purposeVersionState.rejected,
          },
        ],
      };
      const payload: PurposeVersionRejectedV1 = {
        purpose: toPurposeV1(updatedPurpose),
        versionId: mockPurposeVersion.id,
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 2,
        type: "PurposeVersionRejected",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeVersionUpdated", async () => {
      const purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion],
      };
      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurposeVersion: PurposeVersion = {
        ...mockPurposeVersion,
        rejectionReason: "new rejection reason",
      };
      const updatedPurpose: Purpose = {
        ...mockPurpose,
        versions: [updatedPurposeVersion],
      };
      const payload: PurposeVersionUpdatedV1 = {
        purposeId: purpose.id,
        version: toPurposeVersionV1(updatedPurposeVersion),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 2,
        type: "PurposeVersionUpdated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeDeleted", async () => {
      const mockPurpose2: Purpose = {
        ...getMockPurpose(),
        id: generateId(),
        title: "Purpose 2 - test",
      };
      await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes, 1);
      await writeInReadmodel(toReadModelPurpose(mockPurpose2), purposes, 1);

      const payload: PurposeDeletedV1 = {
        purposeId: mockPurpose.id,
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 2,
        type: "PurposeDeleted",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });
      const retrievedPurpose2 = await purposes.findOne({
        "data.id": mockPurpose2.id,
      });

      expect(retrievedPurpose?.data).toBeUndefined();

      expect(retrievedPurpose2?.data).toEqual(toReadModelPurpose(mockPurpose2));
      expect(retrievedPurpose2?.metadata).toEqual({ version: 1 });
    });

    it("PurposeVersionDeleted", async () => {
      const mockPurposeVersion2 = getMockPurposeVersion();

      const purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion, mockPurposeVersion2],
      };
      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion2],
      };
      const payload: PurposeVersionDeletedV1 = {
        purposeId: purpose.id,
        versionId: mockPurposeVersion.id,
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 2,
        type: "PurposeVersionDeleted",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });
  });

  describe("Events V2", async () => {
    const mockPurpose = getMockPurpose();
    it("DraftPurposeDeleted", async () => {
      await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes, 1);

      const payload: DraftPurposeDeletedV2 = {
        purpose: toPurposeV2(mockPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 2,
        type: "DraftPurposeDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });

      expect(retrievedPurpose?.data).toBeUndefined();
    });

    it("PurposeAdded", async () => {
      const payload: PurposeAddedV2 = {
        purpose: toPurposeV2(mockPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 1,
        type: "PurposeAdded",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(toReadModelPurpose(mockPurpose));
      expect(retrievedPurpose?.metadata).toEqual({ version: 1 });
    });

    it("DraftPurposeUpdated", async () => {
      await writeInReadmodel(toReadModelPurpose(mockPurpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...mockPurpose,
        description: "updated description",
      };
      const payload: DraftPurposeUpdatedV2 = {
        purpose: toPurposeV2(updatedPurpose),
      };
      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: mockPurpose.id,
        version: 2,
        type: "DraftPurposeUpdated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("NewPurposeVersionActivated", async () => {
      const purposeVersions: PurposeVersion[] = [
        { ...getMockPurposeVersion(), state: "Active" },
        { ...getMockPurposeVersion(), state: "WaitingForApproval" },
      ];

      const purpose: Purpose = {
        ...mockPurpose,
        versions: purposeVersions,
      };

      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const date = new Date();
      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [
          { ...purposeVersions[0], state: "Archived", updatedAt: date },
          {
            ...purposeVersions[1],
            state: "Active",
            firstActivationAt: date,
            updatedAt: date,
          },
        ],
      };

      const payload: NewPurposeVersionActivatedV2 = {
        purpose: toPurposeV2(updatedPurpose),
        versionId: purposeVersions[1].id,
      };

      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: updatedPurpose.id,
        version: 2,
        type: "NewPurposeVersionActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": updatedPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("NewPurposeVersionWaitingForApproval", async () => {
      const purpose: Purpose = {
        ...mockPurpose,
        versions: [{ ...getMockPurposeVersion(), state: "Active" }],
      };

      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const waitingForApprovalVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: "WaitingForApproval",
      };

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [...purpose.versions, waitingForApprovalVersion],
      };

      const payload: NewPurposeVersionWaitingForApprovalV2 = {
        purpose: toPurposeV2(updatedPurpose),
        versionId: waitingForApprovalVersion.id,
      };

      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: updatedPurpose.id,
        version: 2,
        type: "NewPurposeVersionWaitingForApproval",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": updatedPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeActivated", async () => {
      const draftVersion = getMockPurposeVersion();

      const purpose: Purpose = {
        ...mockPurpose,
        versions: [draftVersion],
      };

      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const date = new Date();
      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [{ ...draftVersion, updatedAt: date, state: "Active" }],
      };

      const payload: PurposeActivatedV2 = {
        purpose: toPurposeV2(updatedPurpose),
      };

      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: updatedPurpose.id,
        version: 2,
        type: "PurposeActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": updatedPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeArchived", async () => {
      const activeVersion = getMockPurposeVersion();

      const purpose: Purpose = {
        ...mockPurpose,
        versions: [activeVersion],
      };

      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const date = new Date();
      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [{ ...activeVersion, updatedAt: date, state: "Archived" }],
      };

      const payload: PurposeArchivedV2 = {
        purpose: toPurposeV2(updatedPurpose),
        versionId: activeVersion.id,
      };

      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: updatedPurpose.id,
        version: 2,
        type: "PurposeArchived",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": updatedPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeVersionOverQuotaUnsuspended", async () => {
      const purposeVersions: PurposeVersion[] = [
        { ...getMockPurposeVersion(), state: "Suspended" },
        { ...getMockPurposeVersion(), state: "WaitingForApproval" },
      ];

      const purpose: Purpose = {
        ...mockPurpose,
        versions: purposeVersions,
      };

      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const date = new Date();
      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [
          { ...purposeVersions[0], state: "Active", updatedAt: date },
          purposeVersions[1],
        ],
      };

      const payload: PurposeVersionOverQuotaUnsuspendedV2 = {
        purpose: toPurposeV2(updatedPurpose),
        versionId: purposeVersions[0].id,
      };

      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: updatedPurpose.id,
        version: 2,
        type: "PurposeVersionOverQuotaUnsuspended",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": updatedPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeVersionRejected", async () => {
      const waitingForApprovalVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: "WaitingForApproval",
      };

      const purpose: Purpose = {
        ...mockPurpose,
        versions: [waitingForApprovalVersion],
      };

      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [{ ...waitingForApprovalVersion, state: "Rejected" }],
      };

      const payload: PurposeVersionRejectedV2 = {
        purpose: toPurposeV2(updatedPurpose),
        versionId: waitingForApprovalVersion.id,
      };

      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: updatedPurpose.id,
        version: 2,
        type: "PurposeVersionRejected",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": updatedPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeVersionSuspendedByConsumer", async () => {
      const activeVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: "Active",
      };

      const purpose: Purpose = {
        ...mockPurpose,
        versions: [activeVersion],
      };

      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [
          { ...activeVersion, state: "Suspended", suspendedAt: new Date() },
        ],
        suspendedByConsumer: true,
        suspendedByProducer: false,
      };

      const payload: PurposeVersionSuspendedByConsumerV2 = {
        purpose: toPurposeV2(updatedPurpose),
        versionId: activeVersion.id,
      };

      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: updatedPurpose.id,
        version: 2,
        type: "PurposeVersionSuspendedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": updatedPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeVersionSuspendedByProducer", async () => {
      const activeVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: "Active",
      };

      const purpose: Purpose = {
        ...mockPurpose,
        versions: [activeVersion],
      };

      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [
          { ...activeVersion, state: "Suspended", suspendedAt: new Date() },
        ],
        suspendedByConsumer: false,
        suspendedByProducer: true,
      };

      const payload: PurposeVersionSuspendedByProducerV2 = {
        purpose: toPurposeV2(updatedPurpose),
        versionId: activeVersion.id,
      };

      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: updatedPurpose.id,
        version: 2,
        type: "PurposeVersionSuspendedByProducer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": updatedPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeVersionUnsuspendedByConsumer", async () => {
      const suspendedVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: "Suspended",
        suspendedAt: new Date(),
      };

      const purpose: Purpose = {
        ...mockPurpose,
        versions: [suspendedVersion],
        suspendedByConsumer: true,
        suspendedByProducer: false,
      };

      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [
          {
            ...suspendedVersion,
            state: "Active",
            suspendedAt: undefined,
            updatedAt: new Date(),
          },
        ],
        suspendedByConsumer: false,
        suspendedByProducer: false,
      };

      const payload: PurposeVersionUnsuspendedByConsumerV2 = {
        purpose: toPurposeV2(updatedPurpose),
        versionId: suspendedVersion.id,
      };

      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: updatedPurpose.id,
        version: 2,
        type: "PurposeVersionUnsuspendedByConsumer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": updatedPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeVersionUnsuspendedByProducer", async () => {
      const suspendedVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: "Suspended",
        suspendedAt: new Date(),
      };

      const purpose: Purpose = {
        ...mockPurpose,
        versions: [suspendedVersion],
        suspendedByConsumer: false,
        suspendedByProducer: true,
      };

      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [
          {
            ...suspendedVersion,
            state: "Active",
            suspendedAt: undefined,
            updatedAt: new Date(),
          },
        ],
        suspendedByConsumer: false,
        suspendedByProducer: false,
      };

      const payload: PurposeVersionUnsuspendedByProducerV2 = {
        purpose: toPurposeV2(updatedPurpose),
        versionId: suspendedVersion.id,
      };

      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: updatedPurpose.id,
        version: 2,
        type: "PurposeVersionUnsuspendedByProducer",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": updatedPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeWaitingForApproval", async () => {
      const draftVersion = getMockPurposeVersion();
      const purpose: Purpose = {
        ...mockPurpose,
        versions: [draftVersion],
      };

      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [
          {
            ...draftVersion,
            state: "WaitingForApproval",
            updatedAt: new Date(),
          },
        ],
      };

      const payload: PurposeWaitingForApprovalV2 = {
        purpose: toPurposeV2(updatedPurpose),
      };

      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: updatedPurpose.id,
        version: 2,
        type: "PurposeWaitingForApproval",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": updatedPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("WaitingForApprovalPurposeVersionDeleted", async () => {
      const purposeVersions: PurposeVersion[] = [
        {
          ...getMockPurposeVersion(),
          state: "Active",
          firstActivationAt: new Date(),
        },
        { ...getMockPurposeVersion(), state: "WaitingForApproval" },
      ];

      const purpose: Purpose = {
        ...mockPurpose,
        versions: purposeVersions,
      };

      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [purposeVersions[0]],
      };

      const payload: WaitingForApprovalPurposeVersionDeletedV2 = {
        purpose: toPurposeV2(updatedPurpose),
        versionId: purposeVersions[1].id,
      };

      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: updatedPurpose.id,
        version: 2,
        type: "WaitingForApprovalPurposeVersionDeleted",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": updatedPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeVersionActivated", async () => {
      const draftVersion = getMockPurposeVersion();
      const purpose: Purpose = {
        ...mockPurpose,
        versions: [draftVersion],
      };

      await writeInReadmodel(toReadModelPurpose(purpose), purposes, 1);

      const updatedPurpose: Purpose = {
        ...purpose,
        versions: [
          {
            ...draftVersion,
            state: "Active",
            updatedAt: new Date(),
            firstActivationAt: new Date(),
          },
        ],
      };

      const payload: PurposeVersionActivatedV2 = {
        purpose: toPurposeV2(updatedPurpose),
        versionId: draftVersion.id,
      };

      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: updatedPurpose.id,
        version: 2,
        type: "PurposeVersionActivated",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": updatedPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(
        toReadModelPurpose(updatedPurpose)
      );
      expect(retrievedPurpose?.metadata).toEqual({ version: 2 });
    });

    it("PurposeCloned", async () => {
      const purposeVersion = getMockPurposeVersion();
      const purpose: Purpose = {
        ...mockPurpose,
        versions: [purposeVersion],
      };

      const clonedPurpose: Purpose = {
        ...purpose,
        id: generateId(),
        createdAt: new Date(),
      };

      const payload: PurposeClonedV2 = {
        purpose: toPurposeV2(clonedPurpose),
        sourcePurposeId: mockPurpose.id,
        sourceVersionId: purposeVersion.id,
      };

      const message: PurposeEventEnvelope = {
        sequence_num: 1,
        stream_id: clonedPurpose.id,
        version: 1,
        type: "PurposeCloned",
        event_version: 2,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV2(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": clonedPurpose.id,
      });

      expect(retrievedPurpose?.data).toEqual(toReadModelPurpose(clonedPurpose));
      expect(retrievedPurpose?.metadata).toEqual({ version: 1 });
    });
  });
});
