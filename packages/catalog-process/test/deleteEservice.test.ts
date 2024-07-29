/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test/index.js";
import {
  EService,
  EServiceDeletedV1,
  Descriptor,
  descriptorState,
  operationForbidden,
  EServiceDraftDescriptorDeletedV2,
  toEServiceV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eserviceNotInDraftState,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  getMockAuthData,
  readLastEserviceEvent,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  postgresDB,
} from "./utils.js";

describe("delete eservice", () => {
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  const mockEService = getMockEService();
  it("should write on event-store for the deletion of an eservice (eservice with no descriptors)", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);
    await catalogService.deleteEService(eservice.id, {
      authData: getMockAuthData(eservice.producerId),
      correlationId: "",
      serviceName: "",
      logger: genericLogger,
    });
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDeleted",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDeletedV1,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.eserviceId).toBe(eservice.id);
  });

  it("should write on event-store for the deletion of an eservice (eservice with a draft descriptor only)", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    await catalogService.deleteEService(eservice.id, {
      authData: getMockAuthData(eservice.producerId),
      correlationId: "",
      serviceName: "",
      logger: genericLogger,
    });

    const descriptorDeletionEvent = await readEventByStreamIdAndVersion(
      eservice.id,
      1,
      "catalog",
      postgresDB
    );
    const eserviceDeletionEvent = await readLastEserviceEvent(eservice.id);

    expect(descriptorDeletionEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDraftDescriptorDeleted",
      event_version: 2,
    });
    expect(eserviceDeletionEvent).toMatchObject({
      stream_id: eservice.id,
      version: "2",
      type: "EServiceDeleted",
      event_version: 2,
    });

    const descriptorDeletionPayload = decodeProtobufPayload({
      messageType: EServiceDraftDescriptorDeletedV2,
      payload: descriptorDeletionEvent.data,
    });
    const eserviceDeletionPayload = decodeProtobufPayload({
      messageType: EServiceDeletedV1,
      payload: eserviceDeletionEvent.data,
    });

    const expectedEserviceWithoutDescriptors: EService = {
      ...eservice,
      descriptors: [],
    };
    expect(eserviceDeletionPayload.eserviceId).toBe(mockEService.id);
    expect(descriptorDeletionPayload).toEqual({
      eservice: toEServiceV2(expectedEserviceWithoutDescriptors),
      descriptorId: eservice.descriptors[0].id,
    });
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    void expect(
      catalogService.deleteEService(mockEService.id, {
        authData: getMockAuthData(mockEService.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    await addOneEService(mockEService);
    expect(
      catalogService.deleteEService(mockEService.id, {
        authData: getMockAuthData(),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw eserviceNotInDraftState if the eservice has both draft and non-draft descriptors", async () => {
    const descriptor1: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
      publishedAt: new Date(),
    };
    const descriptor2: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor1, descriptor2],
    };
    await addOneEService(eservice);
    expect(
      catalogService.deleteEService(eservice.id, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(eserviceNotInDraftState(eservice.id));
  });
});
