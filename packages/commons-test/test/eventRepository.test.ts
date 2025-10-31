/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import { describe, expect, it } from "vitest";
import {
  CorrelationId,
  DescriptorId,
  descriptorState,
  EService,
  EServiceEvent,
  generateId,
  genericInternalError,
  toEServiceV2,
} from "pagopa-interop-models";
import { CreateEvent } from "pagopa-interop-commons";
import { getMockDescriptor, getMockEService } from "../src/testUtils.js";
import { repository } from "./utils.js";

export const toCreateEventEServiceAdded = (
  eservice: EService,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId: eservice.id,
  version: undefined,
  event: {
    type: "EServiceAdded",
    event_version: 2,
    data: { eservice: toEServiceV2(eservice) },
  },
  correlationId,
});

const toCreateEventEServiceDescriptorAdded = (
  eservice: EService,
  version: number,
  descriptorId: DescriptorId,
  correlationId: CorrelationId
): CreateEvent<EServiceEvent> => ({
  streamId: eservice.id,
  version,
  event: {
    type: "EServiceDescriptorAdded",
    event_version: 2,
    data: {
      descriptorId,
      eservice: toEServiceV2(eservice),
    },
  },
  correlationId,
});

describe("EventRepository tests", async () => {
  it("should save events for the same streamId when using the correct version number sequence (createEvent + createEvents)", async () => {
    const correlationId: CorrelationId = generateId();

    const eservice = getMockEService();
    const eserviceCreationEvent = toCreateEventEServiceAdded(
      { ...eservice, descriptors: [] },
      correlationId
    );

    expect(await repository.createEvent(eserviceCreationEvent)).toStrictEqual({
      streamId: eservice.id,
      newVersion: 0,
    });

    const descriptor1 = getMockDescriptor(descriptorState.draft);
    const descriptor2 = getMockDescriptor(descriptorState.draft);

    const descriptorCreationEvent1 = toCreateEventEServiceDescriptorAdded(
      { ...eservice, descriptors: [descriptor1] },
      0,
      descriptor1.id,
      correlationId
    );
    const descriptorCreationEvent2 = toCreateEventEServiceDescriptorAdded(
      { ...eservice, descriptors: [descriptor1, descriptor2] },
      1,
      descriptor2.id,
      correlationId
    );

    expect(
      await repository.createEvents([
        descriptorCreationEvent1,
        descriptorCreationEvent2,
      ])
    ).toStrictEqual({
      events: [
        { streamId: eservice.id, newVersion: 1 },
        { streamId: eservice.id, newVersion: 2 },
      ],
      latestNewVersion: new Map(
        Object.entries({
          [eservice.id]: 2,
        })
      ),
    });
  });

  it("should not save event for the same streamId with the same version number", async () => {
    const correlationId: CorrelationId = generateId();

    const eservice = getMockEService();
    const eserviceCreationEvent = toCreateEventEServiceAdded(
      { ...eservice, descriptors: [] },
      correlationId
    );

    expect(await repository.createEvent(eserviceCreationEvent)).toStrictEqual({
      streamId: eservice.id,
      newVersion: 0,
    });

    const descriptor1 = getMockDescriptor(descriptorState.draft);
    const descriptor2 = getMockDescriptor(descriptorState.draft);

    const descriptorCreationEvent1 = toCreateEventEServiceDescriptorAdded(
      { ...eservice, descriptors: [descriptor1] },
      0,
      descriptor1.id,
      correlationId
    );
    const descriptorCreationEvent2 = toCreateEventEServiceDescriptorAdded(
      { ...eservice, descriptors: [descriptor1, descriptor2] },
      0,
      descriptor2.id,
      correlationId
    );

    await expect(
      repository.createEvents([
        descriptorCreationEvent1,
        descriptorCreationEvent2,
      ])
    ).rejects.toThrowError(
      genericInternalError(
        `Error creating multiple events: error: duplicate key value violates unique constraint "events_stream_id_version_key"`
      )
    );
  });

  it("should save events for the same streamId when using the correct version number sequence (createEvents only)", async () => {
    const correlationId: CorrelationId = generateId();

    const eservice = getMockEService();
    const eserviceCreationEvent = toCreateEventEServiceAdded(
      { ...eservice, descriptors: [] },
      correlationId
    );

    const descriptor1 = getMockDescriptor(descriptorState.draft);
    const descriptor2 = getMockDescriptor(descriptorState.draft);

    const descriptorCreationEvent1 = toCreateEventEServiceDescriptorAdded(
      { ...eservice, descriptors: [descriptor1] },
      0,
      descriptor1.id,
      correlationId
    );
    const descriptorCreationEvent2 = toCreateEventEServiceDescriptorAdded(
      { ...eservice, descriptors: [descriptor1, descriptor2] },
      1,
      descriptor2.id,
      correlationId
    );
    const test = await repository.createEvents([
      eserviceCreationEvent,
      descriptorCreationEvent1,
      descriptorCreationEvent2,
    ]);
    console.log("returned: ", test);
    expect(test).toStrictEqual({
      events: [
        { streamId: eservice.id, newVersion: 0 },
        { streamId: eservice.id, newVersion: 1 },
        { streamId: eservice.id, newVersion: 2 },
      ],
      latestNewVersion: new Map(
        Object.entries({
          [eservice.id]: 2,
        })
      ),
    });
  });
});
