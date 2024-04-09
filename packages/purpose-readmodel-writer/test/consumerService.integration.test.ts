/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { afterEach, afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PurposeCollection,
  ReadModelRepository,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import {
  mongoDBContainer,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { StartedTestContainer } from "testcontainers";
import {
  Purpose,
  PurposeCreatedV1,
  PurposeDeletedV1,
  PurposeEventEnvelope,
  PurposeUpdatedV1,
  PurposeVersion,
  PurposeVersionActivatedV1,
  PurposeVersionArchivedV1,
  PurposeVersionCreatedV1,
  PurposeVersionDeletedV1,
  PurposeVersionRejectedV1,
  PurposeVersionSuspendedV1,
  PurposeVersionUpdatedV1,
  PurposeVersionWaitedForApprovalV1,
  generateId,
  purposeVersionState,
  toPurposeV1,
  toPurposeVersionV1,
} from "pagopa-interop-models";
import { handleMessageV1 } from "../src/purposeConsumerServiceV1.js";

describe("Integration tests", async () => {
  let purposes: PurposeCollection;
  let startedMongoDBContainer: StartedTestContainer;

  const config = readModelWriterConfig();

  beforeAll(async () => {
    startedMongoDBContainer = await mongoDBContainer(config).start();

    config.readModelDbPort = startedMongoDBContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    purposes = readModelRepository.purposes;
  });

  afterEach(async () => {
    await purposes.deleteMany({});
  });

  afterAll(async () => {
    await startedMongoDBContainer.stop();
  });

  describe("Events V1", () => {
    const mockPurpose = getMockPurpose();

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

      expect(retrievedPurpose).toMatchObject({
        data: mockPurpose,
        metadata: { version: 1 },
      });
    });

    it("PurposeVersionCreated", async () => {
      await writeInReadmodel<Purpose>(mockPurpose, purposes, 1);

      const mockPurposeVersion = getMockPurposeVersion();
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
        version: 1,
        type: "PurposeVersionCreated",
        event_version: 1,
        data: payload,
        log_date: new Date(),
      };
      await handleMessageV1(message, purposes);

      const retrievedPurpose = await purposes.findOne({
        "data.id": mockPurpose.id,
      });

      expect(retrievedPurpose).toMatchObject({
        data: updatedPurpose,
        metadata: { version: 1 },
      });
    });

    it("PurposeUpdated", async () => {
      await writeInReadmodel<Purpose>(mockPurpose, purposes, 1);

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

      expect(retrievedPurpose).toMatchObject({
        data: updatedPurpose,
        metadata: { version: 2 },
      });
    });

    it("PurposeVersionActivated", async () => {
      const mockPurposeVersion = getMockPurposeVersion();
      const purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion],
      };
      await writeInReadmodel<Purpose>(purpose, purposes, 1);

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

      expect(retrievedPurpose).toMatchObject({
        data: updatedPurpose,
        metadata: { version: 2 },
      });
    });

    it("PurposeVersionSuspended", async () => {
      const mockPurposeVersion = getMockPurposeVersion();
      const purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion],
      };
      await writeInReadmodel<Purpose>(purpose, purposes, 1);

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

      expect(retrievedPurpose).toMatchObject({
        data: updatedPurpose,
        metadata: { version: 2 },
      });
    });

    it("PurposeVersionArchived", async () => {
      const mockPurposeVersion = getMockPurposeVersion();
      const purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion],
      };
      await writeInReadmodel<Purpose>(purpose, purposes, 1);

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

      expect(retrievedPurpose).toMatchObject({
        data: updatedPurpose,
        metadata: { version: 2 },
      });
    });

    it("PurposeVersionWaitedForApproval", async () => {
      const mockPurposeVersion = getMockPurposeVersion();
      const purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion],
      };
      await writeInReadmodel<Purpose>(purpose, purposes, 1);

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

      expect(retrievedPurpose).toMatchObject({
        data: updatedPurpose,
        metadata: { version: 2 },
      });
    });

    it("PurposeVersionRejected", async () => {
      const mockPurposeVersion = getMockPurposeVersion();
      const purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion],
      };
      await writeInReadmodel<Purpose>(purpose, purposes, 1);

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

      expect(retrievedPurpose).toMatchObject({
        data: updatedPurpose,
        metadata: { version: 2 },
      });
    });

    it("PurposeVersionUpdated", async () => {
      const mockPurposeVersion = getMockPurposeVersion();
      const purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion],
      };
      await writeInReadmodel<Purpose>(purpose, purposes, 1);

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

      expect(retrievedPurpose).toMatchObject({
        data: updatedPurpose,
        metadata: { version: 2 },
      });
    });

    it("PurposeDeleted", async () => {
      const mockPurpose2: Purpose = {
        ...getMockPurpose(),
        id: generateId(),
        title: "Purpose 2 - test",
      };
      await writeInReadmodel<Purpose>(mockPurpose, purposes, 1);
      await writeInReadmodel<Purpose>(mockPurpose2, purposes, 1);

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
      expect(retrievedPurpose2).toMatchObject({
        data: mockPurpose2,
        metadata: { version: 1 },
      });
    });

    it("PurposeVersionDeleted", async () => {
      const mockPurposeVersion1 = getMockPurposeVersion();
      const mockPurposeVersion2 = getMockPurposeVersion();

      const purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion1, mockPurposeVersion2],
      };
      await writeInReadmodel<Purpose>(purpose, purposes, 1);

      const updatedPurpose: Purpose = {
        ...mockPurpose,
        versions: [mockPurposeVersion2],
      };
      const payload: PurposeVersionDeletedV1 = {
        purposeId: purpose.id,
        versionId: mockPurposeVersion1.id,
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

      expect(retrievedPurpose).toMatchObject({
        data: updatedPurpose,
        metadata: { version: 2 },
      });
    });
  });

  describe("Events V2", () => {
    it("PurposeAdded", () => {
      expect(2).toBe(2);
    });
  });
});

const getMockPurpose = (): Purpose => ({
  id: generateId(),
  title: "Purpose 1 - test",
  createdAt: new Date(),
  eserviceId: generateId(),
  consumerId: generateId(),
  description: "Test purpose - description",
  versions: [],
  isFreeOfCharge: true,
});

const getMockPurposeVersion = (): PurposeVersion => ({
  id: generateId(),
  state: "Draft",
  riskAnalysis: {
    id: generateId(),
    contentType: "json",
    path: "path",
    createdAt: new Date(),
  },
  dailyCalls: 10,
  createdAt: new Date(),
});
