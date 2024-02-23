/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterEach, afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EServiceCollection,
  ReadModelRepository,
  consumerConfig,
} from "pagopa-interop-commons";
import { mongoDBContainer } from "pagopa-interop-commons-test";
import {
  EServiceAddedV1,
  EServiceEventEnvelope,
  EServiceTechnologyV1,
  generateId,
} from "pagopa-interop-models";
import { StartedTestContainer } from "testcontainers";
import { handleMessage } from "../src/consumerService.js";

describe("database test", async () => {
  let eservices: EServiceCollection;
  let startedMongoDBContainer: StartedTestContainer;

  const config = consumerConfig();

  beforeAll(async () => {
    startedMongoDBContainer = await mongoDBContainer(config).start();

    config.readModelDbPort = startedMongoDBContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    eservices = readModelRepository.eservices;
  });

  afterEach(async () => {
    await eservices.deleteMany({});
  });

  afterAll(async () => {
    await startedMongoDBContainer.stop();
  });

  describe("Handle message for eservice creation", () => {
    it("should create an eService", async () => {
      const id = generateId();
      const newEService: EServiceAddedV1 = {
        eService: {
          id,
          producerId: generateId(),
          name: "name",
          description: "description",
          technology: EServiceTechnologyV1.REST,
          descriptors: [],
          createdAt: BigInt(new Date().getTime()),
        },
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: id,
        version: 1,
        type: "EServiceAdded",
        data: newEService,
      };
      await handleMessage(message, eservices);

      const eservice = await eservices.findOne({
        "data.id": id.toString,
      });

      expect(eservice?.data).toMatchObject({
        id: newEService.eService?.id,
        producerId: newEService.eService?.producerId,
        name: newEService.eService?.name,
        description: newEService.eService?.description,
      });
    });
  });
});
