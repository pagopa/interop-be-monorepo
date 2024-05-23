/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  AuthorizationEventEnvelopeV2,
  ClientKeyAddedV2,
  EServiceDescriptorSuspendedV2,
  EServiceDescriptorV2,
  EServiceEventEnvelopeV2,
  EServiceV2,
  Key,
  PurposeAddedV2,
  PurposeEventEnvelopeV2,
  descriptorState,
  eserviceMode,
  generateId,
  technology,
  toClientV2,
  toDescriptorV2,
  toEServiceV2,
  toPurposeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { v4 } from "uuid";
import { getMockClient, getMockPurpose } from "pagopa-interop-commons-test";
import {
  QueueManager,
  initQueueManager,
} from "../src/queue-manager/queueManager.js";
import { toCatalogItemEventNotification } from "../src/models/catalog/catalogItemEventNotificationConverter.js";
import { buildCatalogMessage } from "../src/models/catalog/catalogItemEventNotificationMessage.js";
import { buildPurposeMessage } from "../src/models/purpose/purposeEventNotificationMessage.js";
import { buildAuthorizationMessage } from "../src/models/authorization/authorizationEventNotificationMessage.js";
import { toPurposeEventNotification } from "../src/models/purpose/purposeEventNotificationConverter.js";
import { toAuthorizationEventNotification } from "../src/models/authorization/authorizationEventNotificationConverter.js";
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
    attributes: {
      certified: [
        [
          {
            explicitAttributeVerification: true,
            id: unsafeBrandId("cbddada9-ad22-42c9-bb1d-9a832e34179e"),
          },
        ],
      ],
      declared: [
        [
          {
            explicitAttributeVerification: true,
            id: unsafeBrandId("cbddada9-ad22-42c9-bb1d-9a832e34179e"),
          },
        ],
      ],
      verified: [
        [
          {
            explicitAttributeVerification: true,
            id: unsafeBrandId("cbddada9-ad22-42c9-bb1d-9a832e34179e"),
          },
        ],
      ],
    },
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

  describe("Catalog, Purpose, Authorization Event Message", async () => {
    it("should send a message to the queue", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const descriptor = getDescriptorMock(
        "6b48e234-aac6-4d33-aef4-93816588ff41"
      );
      const mockEService = {
        ...getMockEService("d27f668f-630b-4889-a97f-2b7e39b24188"),
        descriptors: [descriptor],
      };

      const catalogEventV2: EServiceDescriptorSuspendedV2 = {
        descriptorId: "6b48e234-aac6-4d33-aef4-93816588ff41",
        eservice: mockEService,
      };

      const catalogEventEnvelope: EServiceEventEnvelopeV2 = {
        sequence_num: 1,
        stream_id: "d27f668f-630b-4889-a97f-2b7e39b24188",
        version: 1,
        correlation_id: v4(),
        log_date: new Date(),
        event_version: 2,
        type: "EServiceDescriptorSuspended",
        data: catalogEventV2,
      };
      const CatalogItemEventNotification =
        toCatalogItemEventNotification(catalogEventEnvelope);

      const catalogMessage = buildCatalogMessage(
        catalogEventEnvelope,
        CatalogItemEventNotification
      );
      await queueWriter.send(catalogMessage, genericLogger);

      const mockPurpose = getMockPurpose();

      const purposeEventV2: PurposeAddedV2 = {
        purpose: toPurposeV2(mockPurpose),
      };

      const purposeEventEnvelope: PurposeEventEnvelopeV2 = {
        sequence_num: 2,
        stream_id: mockPurpose.id,
        version: 1,
        correlation_id: v4(),
        log_date: new Date(),
        event_version: 2,
        type: "PurposeAdded",
        data: purposeEventV2,
      };
      const purposeEventNotification =
        toPurposeEventNotification(purposeEventEnvelope);

      const purposeMessage = buildPurposeMessage(
        purposeEventEnvelope,
        purposeEventNotification
      );

      await queueWriter.send(purposeMessage, genericLogger);

      const key: Key = {
        name: "key",
        createdAt: new Date(),
        kid: "kid",
        encodedPem: generateId(),
        algorithm: "",
        use: "Sig",
      };
      const mockClient = { ...getMockClient(), keys: [key] };
      const authorizationEventV2: ClientKeyAddedV2 = {
        client: toClientV2(mockClient),
        kid: key.kid,
      };

      const authorizationEventEnvelope: AuthorizationEventEnvelopeV2 = {
        sequence_num: 3,
        stream_id: mockClient.id,
        version: 1,
        correlation_id: v4(),
        log_date: new Date(),
        event_version: 2,
        type: "ClientKeyAdded",
        data: authorizationEventV2,
      };
      const authorizationEventNotification = toAuthorizationEventNotification(
        authorizationEventEnvelope
      );

      const authorizationMessage = buildAuthorizationMessage(
        authorizationEventEnvelope,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        authorizationEventNotification!
      );

      await queueWriter.send(authorizationMessage, genericLogger);

      const receivedMessages = await queueWriter.receiveLast(genericLogger, 3);
      expect(receivedMessages.length).toBe(3);

      const receivedCatalogMessage = receivedMessages[0];
      const receivedPurposeMessage = receivedMessages[1];
      const receivedAuthorizationMessage = receivedMessages[2];

      expect(receivedCatalogMessage.payload).toEqual(
        catalogItemDescriptorUpdatedNotification.payload
      );
      expect(receivedPurposeMessage.payload).toEqual({
        purpose: {
          ...mockPurpose,
          createdAt: new Date().toISOString(),
        },
      });
      expect(receivedAuthorizationMessage.payload).toEqual({
        clientId: mockClient.id,
        keys: [
          {
            ...mockClient.keys[0],
            createdAt: new Date().toDateString(),
          },
        ],
      });

      vi.useRealTimers();
    });
  });
});
