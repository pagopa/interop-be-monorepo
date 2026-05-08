import {
  getMockEService,
  getMockDescriptor,
  getMockContextMaintenance,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  generateId,
  MaintenanceEServiceDescriptorUnarchivedV2,
  toEServiceDescriptorStateV2,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";
import { notValidDescriptorState } from "../../src/model/domain/errors.js";

describe("unarchive descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();

  it("should write on event-store and restore to PUBLISHED if it is the latest version", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      version: "1",
      state: descriptorState.archived,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };

    await addOneEService(eservice);

    await catalogService.unarchiveDescriptor(
      eservice.id,
      descriptor.id,
      {},
      getMockContextMaintenance({})
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      type: "MaintenanceEServiceDescriptorUnarchived",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: MaintenanceEServiceDescriptorUnarchivedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice!.descriptors[0].state).toEqual(
      toEServiceDescriptorStateV2(descriptorState.published)
    );
    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
  });

  it("should write on event-store and restore to DEPRECATED if it is NOT the latest version", async () => {
    const descriptorV1: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      version: "1",
      state: descriptorState.archived,
    };
    const descriptorV2: Descriptor = {
      ...mockDescriptor,
      id: generateId(),
      version: "2",
      state: descriptorState.published,
    };

    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptorV1, descriptorV2],
    };

    await addOneEService(eservice);

    await catalogService.unarchiveDescriptor(
      eservice.id,
      descriptorV1.id,
      {},
      getMockContextMaintenance({})
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    const writtenPayload = decodeProtobufPayload({
      messageType: MaintenanceEServiceDescriptorUnarchivedV2,
      payload: writtenEvent.data,
    });

    const restoredDescriptor = writtenPayload.eservice!.descriptors.find(
      (d) => d.id === descriptorV1.id
    );

    expect(restoredDescriptor!.state).toEqual(
      toEServiceDescriptorStateV2(descriptorState.deprecated)
    );
  });

  it("should restore to SUSPENDED if forceTargetState is SUSPENDED, regardless of version", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      version: "1",
      state: descriptorState.archived,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };

    await addOneEService(eservice);

    await catalogService.unarchiveDescriptor(
      eservice.id,
      descriptor.id,
      { forceTargetState: "SUSPENDED" },
      getMockContextMaintenance({})
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    const writtenPayload = decodeProtobufPayload({
      messageType: MaintenanceEServiceDescriptorUnarchivedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.eservice!.descriptors[0].state).toEqual(
      toEServiceDescriptorStateV2(descriptorState.suspended)
    );
  });

  it("should throw descriptorNotInExpectedState if the descriptor is not ARCHIVED", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };

    await addOneEService(eservice);

    expect(
      catalogService.unarchiveDescriptor(
        eservice.id,
        descriptor.id,
        {},
        getMockContextMaintenance({})
      )
    ).rejects.toThrowError(
      notValidDescriptorState(descriptor.id, descriptor.state)
    );
  });
});
