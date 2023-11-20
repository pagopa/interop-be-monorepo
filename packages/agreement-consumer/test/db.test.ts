/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AgreementCollection,
  ReadModelRepository,
  consumerConfig,
  getMongodbContainer,
} from "pagopa-interop-commons";
import { AgreementAddedV1, AgreementStateV1 } from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { EventEnvelope } from "../src/model/models.js";
import { handleMessage } from "../src/agreementConsumerService.js";

describe("database test", async () => {
  let agreements: AgreementCollection;

  const config = consumerConfig();
  beforeAll(async () => {
    const mongodbContainer = await getMongodbContainer({
      dbName: config.readModelDbName,
      username: config.readModelDbUsername,
      password: config.readModelDbPassword,
    }).start();

    config.readModelDbPort = mongodbContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    agreements = readModelRepository.agreements;
  });

  afterEach(async () => {
    await agreements.deleteMany({});
  });

  describe("Handle message for agreement creation", () => {
    it("should create an agreement", async () => {
      const id = uuidv4();
      const newAgreement: AgreementAddedV1 = {
        agreement: {
          id: id,
          eserviceId: uuidv4(),
          descriptorId: uuidv4(),
          producerId: uuidv4(),
          consumerId: uuidv4(),
          state: AgreementStateV1.ACTIVE,
          certifiedAttributes: [],
          declaredAttributes: [],
          verifiedAttributes: [],
          createdAt: BigInt(new Date().getTime()),
          consumerDocuments: [],
        },
      };
      const message: EventEnvelope = {
        sequence_num: 1,
        stream_id: id,
        version: 1,
        type: "AgreementAdded",
        data: newAgreement,
      };
      await handleMessage(message, config);

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
