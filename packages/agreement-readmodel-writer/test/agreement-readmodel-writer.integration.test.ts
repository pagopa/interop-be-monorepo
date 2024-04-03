/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AgreementCollection,
  ReadModelRepository,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import { mongoDBContainer } from "pagopa-interop-commons-test";
import {
  AgreementAddedV1,
  AgreementEventEnvelope,
  AgreementStateV1,
  generateId,
} from "pagopa-interop-models";
import { StartedTestContainer } from "testcontainers";
import { handleMessageV1 } from "../src/consumerServiceV1.js";

describe("database test", async () => {
  let agreements: AgreementCollection;
  let startedMongoDBContainer: StartedTestContainer;

  const config = readModelWriterConfig();
  beforeAll(async () => {
    startedMongoDBContainer = await mongoDBContainer(config).start();

    config.readModelDbPort = startedMongoDBContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    agreements = readModelRepository.agreements;
  });

  afterEach(async () => {
    await agreements.deleteMany({});
  });

  afterAll(async () => {
    await startedMongoDBContainer.stop();
  });

  describe("Handle message for agreement creation", () => {
    it("should create an agreement", async () => {
      const id = generateId();
      const newAgreement: AgreementAddedV1 = {
        agreement: {
          id,
          eserviceId: generateId(),
          descriptorId: generateId(),
          producerId: generateId(),
          consumerId: generateId(),
          state: AgreementStateV1.ACTIVE,
          certifiedAttributes: [],
          declaredAttributes: [],
          verifiedAttributes: [],
          createdAt: BigInt(new Date().getTime()),
          consumerDocuments: [],
        },
      };
      const message: AgreementEventEnvelope = {
        event_version: 1,
        sequence_num: 1,
        stream_id: id,
        version: 1,
        type: "AgreementAdded",
        data: newAgreement,
      };
      await handleMessageV1(message, agreements);

      const agreement = await agreements.findOne({
        "data.id": id.toString,
      });

      expect(agreement?.data).toMatchObject({
        id: newAgreement.agreement?.id,
        eserviceId: newAgreement.agreement?.eserviceId,
        descriptorId: newAgreement.agreement?.descriptorId,
        producerId: newAgreement.agreement?.producerId,
        consumerId: newAgreement.agreement?.consumerId,
      });
    });
  });
});
