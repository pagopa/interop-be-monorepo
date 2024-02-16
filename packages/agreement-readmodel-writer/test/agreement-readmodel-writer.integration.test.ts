/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AgreementCollection,
  ReadModelRepository,
  consumerConfig,
} from "pagopa-interop-commons";
import {
  AgreementAddedV1,
  AgreementEventEnvelope,
  AgreementStateV1,
  generateId,
} from "pagopa-interop-models";
import { GenericContainer } from "testcontainers";
import { handleMessage } from "../src/agreementConsumerService.js";

describe("database test", async () => {
  let agreements: AgreementCollection;

  const config = consumerConfig();
  beforeAll(async () => {
    const mongodbContainer = await new GenericContainer("mongo:4.0.0")
      .withEnvironment({
        MONGO_INITDB_DATABASE: config.readModelDbName,
        MONGO_INITDB_ROOT_USERNAME: config.readModelDbUsername,
        MONGO_INITDB_ROOT_PASSWORD: config.readModelDbPassword,
      })
      .withExposedPorts(27017)
      .start();

    config.readModelDbPort = mongodbContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    agreements = readModelRepository.agreements;
  });

  afterEach(async () => {
    await agreements.deleteMany({});
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
        sequence_num: 1,
        stream_id: id,
        version: 1,
        type: "AgreementAdded",
        data: newAgreement,
      };
      await handleMessage(message, agreements);

      const agreement = await agreements.findOne({
        "data.id": id.toString,
      });

      expect(agreement?.data?.id).toBe(newAgreement.agreement?.id);
      expect(agreement?.data?.eserviceId).toBe(
        newAgreement.agreement?.eserviceId
      );
      expect(agreement?.data?.descriptorId).toBe(
        newAgreement.agreement?.descriptorId
      );
      expect(agreement?.data?.producerId).toBe(
        newAgreement.agreement?.producerId
      );
      expect(agreement?.data?.consumerId).toBe(
        newAgreement.agreement?.consumerId
      );
    });
  });
});
