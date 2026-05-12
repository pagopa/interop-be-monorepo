/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContextInternal,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  DescriptorState,
  descriptorState,
  EService,
  EServiceArchivingCompletedV2,
  toEServiceV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceAlreadyArchived,
  eServiceNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("archive eservice", () => {
  const mockEService = getMockEService();

  const invalidStates = [
    descriptorState.archived,
    descriptorState.draft,
    descriptorState.waitingForApproval,
  ] as DescriptorState[];
  const validStates = Object.values(descriptorState).filter(
    (s) => !invalidStates.includes(s)
  );

  it.each(
    validStates.flatMap((state) =>
      [1, 2, 3, 4, 5].map((count) => [count, state] as const)
    )
  )(
    "should write on event-store for the archiving of an EService with %i descriptor(s) in state %s",
    async (count, state) => {
      const descriptors: Descriptor[] = Array.from(
        { length: count },
        (_, idx) => ({
          ...getMockDescriptor(),
          interface: getMockDocument(),
          version: (idx + 1).toString(),
          state,
        })
      );
      const eservice: EService = {
        ...mockEService,
        descriptors,
      };
      await addOneEService(eservice);
      await catalogService.archiveEService(
        eservice.id,
        getMockContextInternal({})
      );

      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent).toMatchObject({
        stream_id: eservice.id,
        version: "1",
        type: "EServiceArchivingCompleted",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceArchivingCompletedV2,
        payload: writtenEvent.data,
      });

      const expectedDescriptors = descriptors.map((descriptor, idx) => {
        const expectedDescriptor = {
          ...descriptor,
          state: descriptorState.archived,
          archivedAt: new Date(
            Number(writtenPayload.eservice!.descriptors[idx]!.archivedAt)
          ),
        };

        return expectedDescriptor;
      });

      const expectedEService = toEServiceV2({
        ...eservice,
        descriptors: expectedDescriptors,
      });
      expect(writtenPayload.eservice).toEqual(expectedEService);
    }
  );

  it.each([0, 1, 2, 5])(
    "should throw eServiceAlreadyArchived if the eservice has %i descriptors, all in state archived",
    async (count) => {
      const descriptors: Descriptor[] = Array.from(
        { length: count },
        (_, idx) => ({
          ...getMockDescriptor(),
          interface: getMockDocument(),
          version: (idx + 1).toString(),
          state: descriptorState.archived,
        })
      );
      const eservice: EService = {
        ...mockEService,
        descriptors,
      };
      await addOneEService(eservice);
      expect(
        catalogService.archiveEService(eservice.id, getMockContextInternal({}))
      ).rejects.toThrowError(eServiceAlreadyArchived(eservice.id));
    }
  );

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };

    expect(
      catalogService.archiveEService(eservice.id, getMockContextInternal({}))
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
});
