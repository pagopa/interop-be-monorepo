/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  EServiceCollection,
  ReadModelRepository,
  consumerConfig,
  getMongodbContainer,
} from "pagopa-interop-commons";
import { EServiceAddedV1, EServiceTechnologyV1 } from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { handleMessage } from "../src/consumerService.js";
import { EventEnvelope } from "../src/model/models.js";

describe("database test", async () => {
  let eservices: EServiceCollection;

  const config = consumerConfig();
  beforeAll(async () => {
    const mongodbContainer = await getMongodbContainer({
      dbName: config.readModelDbName,
      username: config.readModelDbUsername,
      password: config.readModelDbPassword,
    }).start();

    config.readModelDbPort = mongodbContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    eservices = readModelRepository.eservices;
  });

  afterEach(async () => {
    await eservices.deleteMany({});
  });

  describe("Handle message for eservice creation", () => {
    it("should create an eService", async () => {
      const id = uuidv4();
      const newEService: EServiceAddedV1 = {
        eService: {
          id: uuidv4(),
          producerId: uuidv4(),
          name: "name",
          description: "description",
          technology: EServiceTechnologyV1.REST,
          descriptors: [],
        },
      };
      const message: EventEnvelope = {
        sequence_num: 1,
        stream_id: uuidv4(),
        version: 1,
        type: "EServiceAdded",
        data: newEService,
      };
      await handleMessage(message, config);

      const eservice = await eservices.findOne({
        "data.id": id.toString,
      });

      expect(eservice?.data?.id).toBe(newEService.eService?.id);
      expect(eservice?.data?.producerId).toBe(newEService.eService?.producerId);
      expect(eservice?.data?.name).toBe(newEService.eService?.name);
      expect(eservice?.data?.description).toBe(
        newEService.eService?.description
      );
    });
  });
});
