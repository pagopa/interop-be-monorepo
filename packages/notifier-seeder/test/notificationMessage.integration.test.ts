/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  EServiceDescriptorSuspendedV2,
  EServiceDescriptorV2,
  EServiceEventEnvelopeV2,
  EServiceV2,
  descriptorState,
  eserviceMode,
  generateId,
  technology,
  toDescriptorV2,
  toEServiceV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { v4 } from "uuid";
import {
  QueueManager,
  initQueueManager,
} from "../src/queue-manager/queueManager.js";
import { toCatalogItemEventNotification } from "../src/models/catalogItemEventNotificationConverter.js";
import { buildCatalogMessage } from "../src/models/catalogItemEventNotificationMessage.js";
import { catalogItemDescriptorUpdatedNotification } from "./resources/catalogItemDescriptorUpdate.js";
import { TEST_ELASTIC_MQ_PORT, elasticMQContainer } from "./utils.js";

const getDescriptorMock = (descriptorId: string): EServiceDescriptorV2 =>
  toDescriptorV2({
    id: unsafeBrandId(descriptorId),
    version: "1",
    description: "Questo è un e-service di test",
    docs: [],
    state: descriptorState.suspended,
    interface: {
      id: unsafeBrandId("4f1871f2-0082-4176-9edf-b6cbb735bf4d"),
      name: "interface.yaml",
      contentType: "application/octet-stream",
      checksum:
        "575c48f91d7687237f01e29345c1189bd8b24a8e8d515bd372c8457bd6cb1ae8",
      path: "eservices/docs/4f1871f2-0082-4176-9edf-b6cbb735bf4d/interface.yaml",
      prettyName: "Interfaccia",
      uploadDate: new Date("2024-03-26T10:16:05.449Z"),
    },
    agreementApprovalPolicy: "Automatic",
    attributes: { certified: [], declared: [], verified: [] },
    audience: ["api/v1"],
    createdAt: new Date("2024-03-26T10:16:03.946Z"),
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 100,
    publishedAt: new Date("2024-03-26T10:16:07.841Z"),
    serverUrls: [
      "http://petstore.swagger.io/api/v1",
      "http://petstore.swagger.io/api/v2",
    ],
    suspendedAt: new Date("2024-03-28T15:02:59.845Z"),
    voucherLifespan: 60,
  });

const getMockEService = (id: string): EServiceV2 =>
  toEServiceV2({
    id: unsafeBrandId(id),
    name: "eservice name",
    description: "eservice description",
    createdAt: new Date(),
    producerId: generateId(),
    technology: technology.rest,
    descriptors: [],
    mode: eserviceMode.deliver,
    riskAnalysis: [],
  });

describe("Notification tests", async () => {
  process.env.AWS_CONFIG_FILE = "aws.config.local";

  let startedElasticMQContainer: StartedTestContainer;
  let queueUrl: string;
  let queueWriter: QueueManager;

  beforeAll(async () => {
    startedElasticMQContainer = await elasticMQContainer().start();

    queueUrl = `http://localhost:${startedElasticMQContainer.getMappedPort(
      TEST_ELASTIC_MQ_PORT
    )}/000000000000/sqsLocalQueue.fifo`;

    queueWriter = initQueueManager({
      queueUrl,
      messageGroupId: "test-message-group-id",
      logLevel: "info",
    });
  });

  afterAll(async () => {
    await startedElasticMQContainer.stop();
  });

  describe("Update Descriptor Event Message", async () => {
    it("should send a message to the queue", async () => {
      const descriptor = getDescriptorMock(
        "6b48e234-aac6-4d33-aef4-93816588ff41"
      );
      const mockEService = {
        ...getMockEService("d27f668f-630b-4889-a97f-2b7e39b24188"),
        descriptors: [descriptor],
      };

      const eventV2: EServiceDescriptorSuspendedV2 = {
        descriptorId: "6b48e234-aac6-4d33-aef4-93816588ff41",
        eservice: mockEService,
      };

      const eventEnvelope: EServiceEventEnvelopeV2 = {
        sequence_num: 1,
        stream_id: "d27f668f-630b-4889-a97f-2b7e39b24188",
        version: 1,
        correlation_id: v4(),
        log_date: new Date(),
        event_version: 2,
        type: "EServiceDescriptorSuspended",
        data: eventV2,
      };
      const CatalogItemEventNotification =
        toCatalogItemEventNotification(eventEnvelope);

      const message = buildCatalogMessage(
        eventEnvelope,
        CatalogItemEventNotification
      );
      await queueWriter.send(message);

      const receivedMessage = (await queueWriter.receiveLast())[0];

      expect(receivedMessage.payload).toEqual(
        catalogItemDescriptorUpdatedNotification.payload
      );
    });
  });
});
