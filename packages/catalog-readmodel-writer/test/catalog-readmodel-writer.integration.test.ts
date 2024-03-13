/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterEach, afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EServiceCollection,
  ReadModelRepository,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import {
  mongoDBContainer,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  ClonedEServiceAddedV1,
  Descriptor,
  EService,
  EServiceAddedV1,
  EServiceEventEnvelope,
  EServiceId,
  EServiceModeV1,
  EServiceTechnologyV1,
  EServiceUpdatedV1,
  descriptorState,
  eserviceMode,
  generateId,
  technology,
} from "pagopa-interop-models";
import { StartedTestContainer } from "testcontainers";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import { toEServiceV1 } from "./toEventV1.js";

describe("database test", async () => {
  let eservices: EServiceCollection;
  let startedMongoDBContainer: StartedTestContainer;

  const config = readModelWriterConfig();

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

  describe("Events V1", () => {
    describe("EServiceAdded", () => {
      it("should create an eservice", async () => {
        const id = generateId<EServiceId>();
        const newEservice: EService = getMockEService();
        const newEServicePayloadV1: EServiceAddedV1 = {
          eservice: toEServiceV1(newEservice),
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: id,
          version: 1,
          type: "EServiceAdded",
          event_version: 1,
          data: newEServicePayloadV1,
        };
        await handleMessageV1(message, eservices);

        const eservice = await eservices.findOne({
          "data.id": id.toString,
        });

        expect(eservice?.data).toEqual(newEservice);
      });
    });

    describe("ClonedEServiceAdded", () => {
      it("should clone an eservice", async () => {
        const id = generateId<EServiceId>();
        const newEservice: EService = getMockEService();
        const clonedEServicePayloadV1: ClonedEServiceAddedV1 = {
          eservice: toEServiceV1(newEservice),
        };
        const message: EServiceEventEnvelope = {
          sequence_num: 1,
          stream_id: id,
          version: 1,
          type: "ClonedEServiceAdded",
          event_version: 1,
          data: clonedEServicePayloadV1,
        };
        await handleMessageV1(message, eservices);

        const retrievedEservice = await eservices.findOne({
          "data.id": id.toString,
        });

        expect(retrievedEservice?.data).toEqual(newEservice);
      });
    });

    it("EServiceUpdated", async () => {
      const eservice: EService = getMockEService();

      await writeInReadmodel<EService>(eservice, eservices, 1);

      const updatedEService: EService = {
        ...eservice,
        description: "updated description",
      };
      const updatedEServicePayloadV1: EServiceUpdatedV1 = {
        eservice: toEServiceV1(updatedEService),
      };
      const message: EServiceEventEnvelope = {
        sequence_num: 1,
        stream_id: eservice.id,
        version: 2,
        type: "EServiceUpdated",
        event_version: 1,
        data: updatedEServicePayloadV1,
      };
      await handleMessageV1(message, eservices);

      const retrievedEservice = await eservices.findOne({
        "data.id": eservice.id,
      });

      expect(retrievedEservice?.data).toEqual(updatedEService);
    });
  });
});

export const getMockEService = (): EService => ({
  id: generateId(),
  name: "eservice name",
  description: "eservice description",
  createdAt: new Date(),
  producerId: generateId(),
  technology: technology.rest,
  descriptors: [],
  attributes: undefined,
  mode: eserviceMode.deliver,
  riskAnalysis: [],
});

export const getMockDescriptor = (): Descriptor => ({
  id: generateId(),
  version: "1",
  docs: [],
  state: descriptorState.draft,
  audience: [],
  voucherLifespan: 60,
  dailyCallsPerConsumer: 10,
  dailyCallsTotal: 1000,
  createdAt: new Date(),
  serverUrls: ["pagopa.it"],
  agreementApprovalPolicy: "Automatic",
  attributes: {
    certified: [],
    verified: [],
    declared: [],
  },
});
