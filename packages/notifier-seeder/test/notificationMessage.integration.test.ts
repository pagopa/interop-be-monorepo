import { randomUUID } from "crypto";
import { describe, expect, it, vi } from "vitest";
import {
  Agreement,
  AgreementAddedV2,
  AgreementEventEnvelopeV2,
  AuthorizationEventEnvelopeV2,
  ClientKeyAddedV2,
  EServiceDescriptorSuspendedV2,
  EServiceDescriptorV2,
  EServiceEventEnvelopeV2,
  EServiceV2,
  PurposeAddedV2,
  PurposeEventEnvelopeV2,
  descriptorState,
  eserviceMode,
  generateId,
  technology,
  toAgreementV2,
  toClientV2,
  toDescriptorV2,
  toEServiceV2,
  toPurposeV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockClient,
  getMockKey,
  getMockPurpose,
} from "pagopa-interop-commons-test";
import { toCatalogItemEventNotification } from "../src/models/catalog/catalogItemEventNotificationConverter.js";
import { buildAgreementMessage } from "../src/models/agreement/agreementEventNotificationMessage.js";
import { buildCatalogMessage } from "../src/models/catalog/catalogItemEventNotificationMessage.js";
import { buildPurposeMessage } from "../src/models/purpose/purposeEventNotificationMessage.js";
import { buildAuthorizationMessage } from "../src/models/authorization/authorizationEventNotificationMessage.js";
import { toPurposeEventNotification } from "../src/models/purpose/purposeEventNotificationConverter.js";
import { toAgreementEventNotification } from "../src/models/agreement/agreementEventNotificationConverter.js";
import { toAuthorizationEventNotification } from "../src/models/authorization/authorizationEventNotificationConverter.js";
import { catalogItemDescriptorUpdatedNotification } from "./resources/catalogItemDescriptorUpdate.js";
import { queueWriter } from "./utils.js";

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
  describe("Catalog, Purpose, Agreement, Authorization Event Message", async () => {
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
        correlation_id: randomUUID(),
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
        correlation_id: randomUUID(),
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

      const mockAgreement: Agreement = {
        ...getMockAgreement(),
        createdAt: new Date(),
        updatedAt: undefined,
        consumerDocuments: [],
        stamps: {},
        contract: undefined,
        suspendedAt: undefined,
        signedContract: undefined,
      };

      const agreementEventV2: AgreementAddedV2 = {
        agreement: toAgreementV2(mockAgreement),
      };

      const agreementEventEnvelope: AgreementEventEnvelopeV2 = {
        sequence_num: 2,
        stream_id: mockAgreement.id,
        version: 1,
        correlation_id: randomUUID(),
        log_date: new Date(),
        event_version: 2,
        type: "AgreementAdded",
        data: agreementEventV2,
      };
      const agreementEventNotification = toAgreementEventNotification(
        agreementEventEnvelope
      );

      const agreementMessage = buildAgreementMessage(
        agreementEventEnvelope,
        agreementEventNotification
      );

      await queueWriter.send(agreementMessage, genericLogger);

      const key = getMockKey();
      const mockClient = { ...getMockClient(), keys: [key] };
      const authorizationEventV2: ClientKeyAddedV2 = {
        client: toClientV2(mockClient),
        kid: key.kid,
      };

      const authorizationEventEnvelope: AuthorizationEventEnvelopeV2 = {
        sequence_num: 3,
        stream_id: mockClient.id,
        version: 1,
        correlation_id: randomUUID(),
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

      const receivedMessages = await queueWriter.receiveLast(genericLogger, 4);
      expect(receivedMessages.length).toBe(4);

      const receivedCatalogMessage = receivedMessages[0];
      const receivedPurposeMessage = receivedMessages[1];
      const receivedAgreementMessage = receivedMessages[2];
      const receivedAuthorizationMessage = receivedMessages[3];

      expect(receivedCatalogMessage.payload).toEqual(
        catalogItemDescriptorUpdatedNotification.payload
      );
      expect(receivedPurposeMessage.payload).toEqual({
        purpose: {
          ...mockPurpose,
          createdAt: new Date().toISOString(),
        },
      });
      expect(receivedAgreementMessage.payload).toEqual({
        agreement: {
          ...mockAgreement,
          createdAt: new Date().toISOString(),
        },
      });
      expect(receivedAuthorizationMessage.payload).toEqual({
        clientId: mockClient.id,
        keys: {
          [mockClient.keys[0].kid]: {
            ...mockClient.keys[0],
            createdAt: new Date().toISOString(),
          },
        },
      });

      vi.useRealTimers();
    });
  });
});
