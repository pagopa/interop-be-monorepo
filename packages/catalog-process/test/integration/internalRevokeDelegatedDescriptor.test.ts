/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContextInternal,
  getMockEService,
  getMockDescriptor,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorUpdatedByRevokedDelegationV2,
  toEServiceV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";

import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("Change state to draft of delegated descriptor after delegation revoke", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();

  it("should write on event-store for the update of a delegated descriptor in waitingForApproval state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.waitingForApproval,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    await catalogService.internalRevokeDelegatedDescriptor(
      eservice.id,
      descriptor.id,
      getMockContextInternal({})
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorUpdatedByRevokedDelegation",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorUpdatedByRevokedDelegationV2,
      payload: writtenEvent.data,
    });

    const updatedDescriptor: Descriptor = {
      ...descriptor,
      state: descriptorState.draft,
    };

    const expectedEService = toEServiceV2({
      ...eservice,
      descriptors: [updatedDescriptor],
    });
    expect(writtenPayload).toEqual({
      descriptorId: descriptor.id,
      eservice: expectedEService,
    });
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    await expect(
      catalogService.internalRevokeDelegatedDescriptor(
        mockEService.id,
        mockDescriptor.id,
        getMockContextInternal({})
      )
    ).rejects.toThrow(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.internalRevokeDelegatedDescriptor(
        eservice.id,
        mockDescriptor.id,
        getMockContextInternal({})
      )
    ).rejects.toThrow(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it.each([
    descriptorState.published,
    descriptorState.suspended,
    descriptorState.archived,
    descriptorState.archiving,
    descriptorState.archivingSuspended,
    descriptorState.draft,
  ])(
    "should throw notValidDescriptorState if the descriptor is in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: state,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      await expect(
        catalogService.internalRevokeDelegatedDescriptor(
          eservice.id,
          descriptor.id,
          getMockContextInternal({})
        )
      ).rejects.toThrow(notValidDescriptorState(descriptor.id, state));
    }
  );
});
