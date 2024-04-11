/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { decodeProtobufPayload } from "pagopa-interop-commons-test";
import { EService, EServiceAddedV2, toEServiceV2 } from "pagopa-interop-models";
import {
  eServiceDuplicate,
  originNotCompliant,
} from "../src/model/domain/errors.js";
import {
  catalogService,
  eservices,
  mockEService,
  postgresDB,
} from "./catalogService.integration.test.js";
import {
  addOneEService,
  getMockAuthData,
  readLastEserviceEvent,
} from "./utils.js";

export const testCreateEService = (): ReturnType<typeof describe> =>
  describe("create eservice", () => {
    it("should write on event-store for the creation of an eservice", async () => {
      const eservice = await catalogService.createEService(
        {
          name: mockEService.name,
          description: mockEService.description,
          technology: "REST",
          mode: "DELIVER",
        },
        getMockAuthData(mockEService.producerId),
        uuidv4()
      );

      expect(eservice).toBeDefined();
      const writtenEvent = await readLastEserviceEvent(eservice.id, postgresDB);
      expect(writtenEvent).toMatchObject({
        stream_id: eservice.id,
        version: "0",
        type: "EServiceAdded",
        event_version: 2,
      });
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceAddedV2,
        payload: writtenEvent.data,
      });

      const expectedEservice: EService = {
        ...mockEService,
        createdAt: new Date(Number(writtenPayload.eservice!.createdAt)),
        id: eservice.id,
      };

      expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEservice));
    });

    it("should throw eServiceDuplicate if an eservice with the same name already exists", async () => {
      await addOneEService(mockEService, postgresDB, eservices);
      expect(
        catalogService.createEService(
          {
            name: mockEService.name,
            description: mockEService.description,
            technology: "REST",
            mode: "DELIVER",
          },
          getMockAuthData(mockEService.producerId),
          uuidv4()
        )
      ).rejects.toThrowError(eServiceDuplicate(mockEService.name));
    });

    it("should throw originNotCompliant if the requester externalId origin is not allowed", async () => {
      expect(
        catalogService.createEService(
          {
            name: mockEService.name,
            description: mockEService.description,
            technology: "REST",
            mode: "DELIVER",
          },
          {
            ...getMockAuthData(mockEService.producerId),
            externalId: {
              value: "123456",
              origin: "not-allowed-origin",
            },
          },
          uuidv4()
        )
      ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
    });
  });
