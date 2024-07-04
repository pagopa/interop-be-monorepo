/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { decodeProtobufPayload } from "pagopa-interop-commons-test/index.js";
import { EServiceAddedV2, EService, toEServiceV2 } from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceDuplicate,
  originNotCompliant,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  getMockAuthData,
  getMockEService,
  readLastEserviceEvent,
} from "./utils.js";

describe("create eservice", () => {
  const mockEService = getMockEService();
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
    const writtenEvent = await readLastEserviceEvent(eservice.id);
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
    await addOneEService(mockEService);
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
