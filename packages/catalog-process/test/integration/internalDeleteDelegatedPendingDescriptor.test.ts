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
  EServiceDeletedbyRevokeV2,
  EServicePendingDescriptorDeletedbyRevokeV2,
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

describe("delete pending delegated descriptor after delegation revoke", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();

  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should write on event-store for the deleting of a descriptor in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState.published,
      };

      const pendingDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: state,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor, pendingDescriptor],
      };
      await addOneEService(eservice);
      await catalogService.internalDeleteDelegatedPendingDescriptor(
        eservice.id,
        pendingDescriptor.id,
        getMockContextInternal({})
      );

      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent).toMatchObject({
        stream_id: eservice.id,
        version: "1",
        type: "EServicePendingDescriptorDeletedbyRevoke",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: EServicePendingDescriptorDeletedbyRevokeV2,
        payload: writtenEvent.data,
      });

      const expectedEService = toEServiceV2({
        ...eservice,
        descriptors: [descriptor],
      });
      expect(writtenPayload).toEqual({
        descriptorId: pendingDescriptor.id,
        eservice: expectedEService,
      });
    }
  );

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    await expect(
      catalogService.internalDeleteDelegatedPendingDescriptor(
        mockEService.id,
        mockDescriptor.id,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.internalDeleteDelegatedPendingDescriptor(
        eservice.id,
        mockDescriptor.id,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it.each([
    descriptorState.published,
    descriptorState.suspended,
    descriptorState.archived,
    descriptorState.archiving,
    descriptorState.archivingSuspended,
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
        catalogService.internalDeleteDelegatedPendingDescriptor(
          eservice.id,
          descriptor.id,
          getMockContextInternal({})
        )
      ).rejects.toThrowError(notValidDescriptorState(descriptor.id, state));
    }
  );

  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "Should delete EService if the only descriptor is the pending one",
    async (state) => {
      const pendingDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: state,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [pendingDescriptor],
      };
      await addOneEService(eservice);
      await catalogService.internalDeleteDelegatedPendingDescriptor(
        eservice.id,
        pendingDescriptor.id,
        getMockContextInternal({})
      );

      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent).toMatchObject({
        stream_id: eservice.id,
        version: "2",
        type: "EServiceDeletedbyRevoke",
        event_version: 2,
      });
    }
  );
});
