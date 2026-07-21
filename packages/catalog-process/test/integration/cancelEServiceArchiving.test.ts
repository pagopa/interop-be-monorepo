/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
  getMockEService,
  getMockDescriptor,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  operationForbidden,
  EServiceArchivingCanceledV2,
  generateId,
  archivingScope,
  GracePeriodDays,
  gracePeriodDays,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eserviceNotInArchiving,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("cancel eservice archiving", () => {
  const mockEService = getMockEService();

  const getArchivingScheduleEService = (
    gracePeriodDaysValue: GracePeriodDays
  ) =>
    ({
      archivableOn: new Date(),
      startedAt: new Date(),
      scope: archivingScope.eservice,
      gracePeriodDays: gracePeriodDaysValue,
    }) as const;

  it.each<{
    description: string;
    initialState: Descriptor["state"];
    extraDescriptorProps: Partial<Descriptor>;
    expectedOlderState: Descriptor["state"];
    expectedLatestState: Descriptor["state"];
    gracePeriodDaysValue: GracePeriodDays;
  }>(
    [
      {
        description:
          "restoring published state for vLatest in archiving and deprecated for older descriptors",
        initialState: descriptorState.archiving,
        extraDescriptorProps: {},
        expectedOlderState: descriptorState.deprecated,
        expectedLatestState: descriptorState.published,
      },
      {
        description:
          "restoring suspended state for archivingSuspended descriptors",
        initialState: descriptorState.archivingSuspended,
        extraDescriptorProps: { suspendedAt: new Date() },
        expectedOlderState: descriptorState.suspended,
        expectedLatestState: descriptorState.suspended,
      },
    ].flatMap((testCase) =>
      gracePeriodDays.map((gracePeriodDaysValue) => ({
        ...testCase,
        gracePeriodDaysValue,
      }))
    )
  )(
    "should write on event-store $description (gracePeriodDays: $gracePeriodDaysValue)",
    async ({
      initialState,
      extraDescriptorProps,
      expectedOlderState,
      expectedLatestState,
      gracePeriodDaysValue,
    }) => {
      const archivingScheduleEService =
        getArchivingScheduleEService(gracePeriodDaysValue);
      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        state: initialState,
        version: "1",
        archivingSchedule: archivingScheduleEService,
        ...extraDescriptorProps,
      };
      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        state: initialState,
        version: "2",
        archivingSchedule: archivingScheduleEService,
        ...extraDescriptorProps,
      };
      const eservice: EService = {
        ...mockEService,
        archivingReason: "some reason",
        descriptors: [descriptor1, descriptor2],
      };
      await addOneEService(eservice);

      const result = await catalogService.cancelEServiceArchiving(
        eservice.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent).toMatchObject({
        stream_id: eservice.id,
        version: "1",
        type: "EServiceArchivingCanceled",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceArchivingCanceledV2,
        payload: writtenEvent.data,
      });

      const expectedEService: EService = {
        ...eservice,
        descriptors: [
          {
            ...descriptor1,
            state: expectedOlderState,
            archivingSchedule: undefined,
          },
          {
            ...descriptor2,
            state: expectedLatestState,
            archivingSchedule: undefined,
          },
        ],
        archivingReason: undefined,
      };

      expect(writtenPayload.eservice).toEqual(toEServiceV2(expectedEService));
      expect(result).toEqual({
        data: expectedEService,
        metadata: { version: parseInt(writtenEvent.version, 10) },
      });
    }
  );

  it.each([...gracePeriodDays])(
    "should not modify descriptors with scope == Descriptor (gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const descriptorWithDescriptorScope: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.archiving,
        version: "1",
        archivingSchedule: {
          archivableOn: new Date(),
          startedAt: new Date(),
          scope: archivingScope.descriptor,
          gracePeriodDays: gracePeriodDaysValue,
        },
      };
      const descriptorWithEServiceScope: Descriptor = {
        ...getMockDescriptor(),
        id: generateId(),
        state: descriptorState.archiving,
        version: "2",
        archivingSchedule: getArchivingScheduleEService(gracePeriodDaysValue),
      };
      const eservice: EService = {
        ...mockEService,
        archivingReason: "some reason",
        descriptors: [
          descriptorWithDescriptorScope,
          descriptorWithEServiceScope,
        ],
      };
      await addOneEService(eservice);

      const result = await catalogService.cancelEServiceArchiving(
        eservice.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

      const expectedEService: EService = {
        ...eservice,
        descriptors: [
          descriptorWithDescriptorScope,
          {
            ...descriptorWithEServiceScope,
            state: descriptorState.published,
            archivingSchedule: undefined,
          },
        ],
        archivingReason: undefined,
      };

      expect(result.data).toEqual(expectedEService);
    }
  );

  it.each([...gracePeriodDays])(
    "should not modify descriptors already in archived state (gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const archivedDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.archived,
        version: "1",
      };
      const archivingDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.archiving,
        version: "2",
        archivingSchedule: getArchivingScheduleEService(gracePeriodDaysValue),
      };
      const eservice: EService = {
        ...mockEService,
        archivingReason: "some reason",
        descriptors: [archivedDescriptor, archivingDescriptor],
      };
      await addOneEService(eservice);

      const result = await catalogService.cancelEServiceArchiving(
        eservice.id,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );

      const expectedEService: EService = {
        ...eservice,
        descriptors: [
          archivedDescriptor,
          {
            ...archivingDescriptor,
            state: descriptorState.published,
            archivingSchedule: undefined,
          },
        ],
        archivingReason: undefined,
      };

      expect(result.data).toEqual(expectedEService);
    }
  );

  it("should throw eServiceNotFound if the eservice does not exist", async () => {
    await expect(
      catalogService.cancelEServiceArchiving(
        mockEService.id,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.archiving,
      version: "1",
      archivingSchedule: getArchivingScheduleEService(30),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await expect(
      catalogService.cancelEServiceArchiving(eservice.id, getMockContext({}))
    ).rejects.toThrowError(operationForbidden);
  });

  it.each<{
    description: string;
    descriptorOverrides: Partial<Descriptor>;
  }>([
    {
      description: "no descriptor has EService scope",
      descriptorOverrides: {
        state: descriptorState.archiving,
        version: "1",
        archivingSchedule: {
          archivableOn: new Date(),
          startedAt: new Date(),
          scope: archivingScope.descriptor,
          gracePeriodDays: 30,
        },
      },
    },
    {
      description: "the latest descriptor has no archivingSchedule",
      descriptorOverrides: {
        state: descriptorState.published,
        version: "1",
      },
    },
  ])(
    "should throw eserviceNotInArchiving if $description",
    async ({ descriptorOverrides }) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        ...descriptorOverrides,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      await expect(
        catalogService.cancelEServiceArchiving(
          eservice.id,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(eserviceNotInArchiving(eservice.id));
    }
  );
});
