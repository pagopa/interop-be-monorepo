/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import { decodeProtobufPayload } from "pagopa-interop-commons-test";
import { EService, EServiceAddedV2, toEServiceV2 } from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { getMockAuthData } from "pagopa-interop-commons-test";
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
import { addOneEService, readLastEserviceEvent } from "./utils.js";

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
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
          {
            authData: getMockAuthData(mockEService.producerId),
            correlationId: "",
            serviceName: "",
            logger: genericLogger,
          }
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
            authData: {
              ...getMockAuthData(mockEService.producerId),
              externalId: {
                value: "123456",
                origin: "not-allowed-origin",
              },
            },
            correlationId: "",
            serviceName: "",
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
    });
  });
