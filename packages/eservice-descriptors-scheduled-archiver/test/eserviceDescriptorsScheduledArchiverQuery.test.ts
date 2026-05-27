/* eslint-disable functional/no-let */
import {
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  beforeAll,
  describe,
  expect,
  it,
  vi,
  afterEach,
  beforeEach,
} from "vitest";
import {
  Descriptor,
  DescriptorState,
  EService,
  TenantId,
  descriptorState,
  generateId,
} from "pagopa-interop-models";
import {
  CatalogProcessZodiosClient,
  catalogProcessClientBuilder,
} from "../src/services/catalogProcessClient.js";
import { addOneEService, readModelService, toUTCMidnight } from "./utils.js";
import { ArchivableDescriptorRef } from "../src/models/models.js";

describe("EService Descriptors Scheduled Archiver Queries", async () => {
  let catalogProcessClient: CatalogProcessZodiosClient;

  beforeAll(async () => {
    catalogProcessClient = catalogProcessClientBuilder("mockUrl");
  });

  beforeEach(async () => {
    // eslint-disable-next-line functional/immutable-data
    catalogProcessClient.archiveDescriptor = vi.fn();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  const archivingStates: DescriptorState[] = [
    descriptorState.archiving,
    descriptorState.archivingSuspended,
  ];

  const notArchivingStates = Object.values(descriptorState).filter(
    (state) => !archivingStates.includes(state)
  );
  describe("getArchivableDescriptorRefs", async () => {
    it.each(
      [0, 1, 2, 365].flatMap((daysBefore) =>
        archivingStates.map((state) => [state, daysBefore] as const)
      )
    )(
      "should return Descriptor refs when archivableOn is archivable and state is %s and archivableOn is %s days before today",
      async (state, daysBefore) => {
        const producerId: TenantId = generateId();

        const numberOfArchivableDescriptors = 5;

        const expectedRefs: ArchivableDescriptorRef[] = await Promise.all(
          Array.from(
            { length: numberOfArchivableDescriptors },
            async (): Promise<ArchivableDescriptorRef> => {
              const descriptor: Descriptor = {
                ...getMockDescriptor(),
                state,
                archivingSchedule: {
                  archivableOn: new Date(
                    toUTCMidnight(new Date(), -daysBefore)
                  ),
                  startedAt: new Date(
                    toUTCMidnight(new Date(), -(30 + daysBefore))
                  ),
                  scope: "Descriptor",
                },
              };

              const eservice = {
                ...getMockEService(),
                producerId,
                descriptors: [descriptor],
              };

              await addOneEService(eservice);

              return {
                eserviceId: eservice.id,
                descriptorId: descriptor.id,
              };
            }
          )
        );

        const refs = await readModelService.getArchivableDescriptorRefs();

        expect(refs).toEqual(expect.arrayContaining(expectedRefs));
        expect(expectedRefs).toEqual(expect.arrayContaining(refs));
      }
    );

    it.each(notArchivingStates)(
      "should return empty list when Descriptor is in state %s",
      async (state) => {
        const producerId: TenantId = generateId();

        const numberOfNonArchivableDescriptors = 5;

        await Promise.all(
          Array.from(
            { length: numberOfNonArchivableDescriptors },
            async (): Promise<ArchivableDescriptorRef> => {
              const descriptor: Descriptor = {
                ...getMockDescriptor(),
                state,
                version: "1",
              };

              const eservice = {
                ...getMockEService(),
                producerId,
                descriptors: [descriptor],
              };

              await addOneEService(eservice);

              return {
                eserviceId: eservice.id,
                descriptorId: descriptor.id,
              };
            }
          )
        );

        const refs = await readModelService.getArchivableDescriptorRefs();
        expect(refs.length).toEqual(0);
      }
    );

    it.each(
      [1, 2, 365].flatMap((daysAfter) =>
        archivingStates.map((state) => [state, daysAfter] as const)
      )
    )(
      "should return empty list when Descriptor archivableOn is not archivable and in state %s and archivableOn is %s days after today",
      async (state, daysAfter) => {
        const producerId: TenantId = generateId();

        const numberOfNonArchivableDescriptors = 5;

        await Promise.all(
          Array.from(
            { length: numberOfNonArchivableDescriptors },
            async (): Promise<ArchivableDescriptorRef> => {
              const descriptor: Descriptor = {
                ...getMockDescriptor(),
                state,
                archivingSchedule: {
                  archivableOn: new Date(toUTCMidnight(new Date(), daysAfter)),
                  startedAt: new Date(toUTCMidnight(new Date(), -30)),
                  scope: "Descriptor",
                },
              };

              const eservice = {
                ...getMockEService(),
                producerId,
                descriptors: [descriptor],
              };

              await addOneEService(eservice);

              return {
                eserviceId: eservice.id,
                descriptorId: descriptor.id,
              };
            }
          )
        );

        const refs = await readModelService.getArchivableDescriptorRefs();
        expect(refs.length).toEqual(0);
      }
    );

    it.each(
      [0, 1, 2, 365].flatMap((daysBefore) =>
        archivingStates.map((state) => [state, daysBefore] as const)
      )
    )(
      "should return list of Descriptor refs only when is not in archiving state in state %s and archivableOn is %s days before today",
      async (state, daysBefore) => {
        const producerId: TenantId = generateId();

        const numberOfArchivableDescriptors = 5;
        const numberOfNonArchivableDescriptors = 5;

        const archivableRefs: ArchivableDescriptorRef[] = await Promise.all(
          Array.from(
            { length: numberOfArchivableDescriptors },
            async (): Promise<ArchivableDescriptorRef> => {
              const descriptor: Descriptor = {
                ...getMockDescriptor(),
                state,
                archivingSchedule: {
                  archivableOn: new Date(
                    toUTCMidnight(new Date(), -daysBefore)
                  ),
                  startedAt: new Date(toUTCMidnight(new Date(), -30)),
                  scope: "Descriptor",
                },
              };

              const eservice = {
                ...getMockEService(),
                producerId,
                descriptors: [descriptor],
              };

              await addOneEService(eservice);

              return {
                eserviceId: eservice.id,
                descriptorId: descriptor.id,
              };
            }
          )
        );

        await Promise.all(
          Array.from(
            { length: numberOfNonArchivableDescriptors },
            async (): Promise<ArchivableDescriptorRef> => {
              const descriptor: Descriptor = {
                ...getMockDescriptor(),
                state: descriptorState.published,
                version: "1",
              };

              const eservice = {
                ...getMockEService(),
                producerId,
                descriptors: [descriptor],
              };

              await addOneEService(eservice);

              return {
                eserviceId: eservice.id,
                descriptorId: descriptor.id,
              };
            }
          )
        );

        const refs = await readModelService.getArchivableDescriptorRefs();
        expect(refs).toEqual(expect.arrayContaining(archivableRefs));
        expect(archivableRefs).toEqual(expect.arrayContaining(refs));
      }
    );
  });

  describe("getArchivableEserviceRefs", async () => {
    it.each(
      [0, 1, 2, 365].flatMap((daysBefore) =>
        archivingStates.map((state) => [state, daysBefore] as const)
      )
    )(
      "should return an array with all EServices to be archived when their descriptors are in state %s and archivableOn is %s days before today",
      async (state, daysBefore) => {
        const producerId: TenantId = generateId();

        const numberOfArchivableDescriptors = 5;

        const eservice: EService = {
          ...getMockEService(),
          producerId,
          descriptors: [],
        };

        let i = 0;

        await Promise.all(
          Array.from({ length: numberOfArchivableDescriptors }, async () => {
            i++;
            const descriptor: Descriptor = {
              ...getMockDescriptor(),
              state,
              version: i.toString(),
              archivingSchedule: {
                archivableOn: new Date(toUTCMidnight(new Date(), -daysBefore)),
                startedAt: new Date(toUTCMidnight(new Date(), -30)),
                scope: "EService",
              },
            };

            eservice.descriptors.push(descriptor);
          })
        );

        await addOneEService(eservice);

        const eserviceIds = await readModelService.getArchivableEserviceRefs();

        expect(eserviceIds).toEqual([eservice.id]);
      }
    );

    it.each(
      [1, 2, 365]
        .flatMap((daysAfter) =>
          archivingStates.map((state) => [state, daysAfter] as const)
        )
        .flatMap(([state, daysAfter]) =>
          notArchivingStates.map(
            (notArchivingState) =>
              [state, daysAfter, notArchivingState] as const
          )
        )
    )(
      "should return an empty array when the EService in archiving is in state %s but is archivable in %i days, and the EService not in archiving is in state %s",
      async (archivingState, daysAfter, notArchivingState) => {
        const producerId: TenantId = generateId();

        const nonArchivableDescriptor: Descriptor = {
          ...getMockDescriptor(),
          state: archivingState,
          version: "1",
          archivingSchedule: {
            archivableOn: new Date(toUTCMidnight(new Date(), daysAfter)),
            startedAt: new Date(toUTCMidnight(new Date(), -30)),
            scope: "EService",
          },
        };

        const nonArchivableEservice: EService = {
          ...getMockEService(),
          producerId,
          descriptors: [nonArchivableDescriptor],
        };

        const nonArchivingDescriptor: Descriptor = {
          ...getMockDescriptor(),
          state: notArchivingState,
          version: "1",
        };

        const nonArchivingEservice: EService = {
          ...getMockEService(),
          producerId,
          descriptors: [nonArchivingDescriptor],
        };

        await addOneEService(nonArchivableEservice);
        await addOneEService(nonArchivingEservice);

        const eserviceIds = await readModelService.getArchivableEserviceRefs();

        expect(eserviceIds.length).toEqual(0);
      }
    );
  });

  describe("getEServiceWithUnarchivableDescriptors", async () => {
    it("should return an empty array when all eservices have the correct states", async () => {
      const producerId: TenantId = generateId();

      const numberOfArchivableDescriptors = 5;

      const eservice: EService = {
        ...getMockEService(),
        producerId,
        descriptors: [],
      };

      let i = 0;

      await Promise.all(
        Array.from({ length: numberOfArchivableDescriptors }, async () => {
          i++;
          const descriptor: Descriptor = {
            ...getMockDescriptor(),
            state: descriptorState.archiving,
            version: i.toString(),
            archivingSchedule: {
              archivableOn: new Date(toUTCMidnight(new Date(), -1)),
              startedAt: new Date(toUTCMidnight(new Date(), -30)),
              scope: "EService",
            },
          };

          eservice.descriptors.push(descriptor);
        })
      );

      await addOneEService(eservice);

      const testQuery =
        await readModelService.getEServiceWithUnarchivableDescriptors([
          eservice.id,
        ]);

      expect(testQuery.length).toEqual(0);
    });

    it.each(
      Object.values(descriptorState).filter(
        (s) =>
          !(
            [
              descriptorState.archiving,
              descriptorState.archivingSuspended,
              descriptorState.archived,
            ] as DescriptorState[]
          ).includes(s)
      )
    )(
      "should return an array with the list of unarchivable eservices if one of their descriptor has state %s",
      async (state) => {
        const producerId: TenantId = generateId();

        const numberOfArchivableDescriptors = 5;
        const numberOfNonArchivableDescriptors = 5;

        const eservice: EService = {
          ...getMockEService(),
          producerId,
          descriptors: [],
        };

        let i = 0;

        await Promise.all(
          Array.from({ length: numberOfArchivableDescriptors }, async () => {
            i++;
            const descriptor: Descriptor = {
              ...getMockDescriptor(),
              state: descriptorState.archiving,
              version: i.toString(),
              archivingSchedule: {
                archivableOn: new Date(toUTCMidnight(new Date(), -1)),
                startedAt: new Date(toUTCMidnight(new Date(), -30)),
                scope: "EService",
              },
            };

            eservice.descriptors.push(descriptor);
          })
        );

        const expectedUnarchivableDescriptors: Descriptor[] = [];

        await Promise.all(
          Array.from({ length: numberOfNonArchivableDescriptors }, async () => {
            i++;
            const descriptor: Descriptor = {
              ...getMockDescriptor(),
              state,
              version: i.toString(),
              archivingSchedule: {
                archivableOn: new Date(toUTCMidnight(new Date(), -1)),
                startedAt: new Date(toUTCMidnight(new Date(), -30)),
                scope: "EService",
              },
            };

            eservice.descriptors.push(descriptor);
            expectedUnarchivableDescriptors.push(descriptor);
          })
        );

        await addOneEService(eservice);

        const testQuery =
          await readModelService.getEServiceWithUnarchivableDescriptors([
            eservice.id,
          ]);

        expect(testQuery).toEqual([
          {
            eserviceId: eservice.id,
            unarchivableDescriptors: expectedUnarchivableDescriptors.map(
              (d) => ({
                id: d.id,
                state: d.state,
                scope: d.archivingSchedule?.scope,
              })
            ),
          },
        ]);
        expect(testQuery[0].unarchivableDescriptors.length).toEqual(
          numberOfNonArchivableDescriptors
        );
      }
    );
  });
});
