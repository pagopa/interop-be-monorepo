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
import { toUTCMidnight } from "pagopa-interop-commons";
import {
  Descriptor,
  EService,
  TenantId,
  descriptorState,
  generateId,
} from "pagopa-interop-models";
import {
  CatalogProcessZodiosClient,
  catalogProcessClientBuilder,
} from "../src/services/catalogProcessClient.js";
import { addOneEService, readModelService } from "./utils.js";
import { RefsToBeArchived } from "../src/models/models.js";

describe("eserviceDescriptorsArchiverSchedulerQuery", async () => {
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
  describe("getExpiredArchivableDescriptorRefs", async () => {
    it.each([descriptorState.archiving, descriptorState.archivingSuspended])(
      "should return Descriptor refs when archivableOn is expired and state is %s",
      async (state) => {
        const producerId: TenantId = generateId();

        const numberOfArchivableDescriptors = 5;

        const expectedRefs: RefsToBeArchived[] = await Promise.all(
          Array.from(
            { length: numberOfArchivableDescriptors },
            async (): Promise<RefsToBeArchived> => {
              const descriptor: Descriptor = {
                ...getMockDescriptor(),
                state,
                archivingSchedule: {
                  archivableOn: new Date(Date.now() - 24 * 60 * 60 * 1000),
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

        const refs =
          await readModelService.getExpiredArchivableDescriptorRefs();

        expect(refs).toEqual(expect.arrayContaining(expectedRefs));
        expect(expectedRefs).toEqual(expect.arrayContaining(refs));
      }
    );

    const notArchivingStates = [
      descriptorState.published,
      descriptorState.deprecated,
      descriptorState.suspended,
      descriptorState.archived,
      descriptorState.waitingForApproval,
      descriptorState.draft,
    ];

    it.each(notArchivingStates)(
      "should return empty list when Descriptor is in state %s",
      async (state) => {
        const producerId: TenantId = generateId();

        const numberOfNonArchivableDescriptors = 5;

        await Promise.all(
          Array.from(
            { length: numberOfNonArchivableDescriptors },
            async (): Promise<RefsToBeArchived> => {
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

        const refs =
          await readModelService.getExpiredArchivableDescriptorRefs();
        expect(refs.length).toEqual(0);
      }
    );

    it.each([descriptorState.archiving, descriptorState.archivingSuspended])(
      "should return empty list when Descriptor archivableOn is not expired and in state %s",
      async (state) => {
        const producerId: TenantId = generateId();

        const numberOfNonArchivableDescriptors = 5;

        await Promise.all(
          Array.from(
            { length: numberOfNonArchivableDescriptors },
            async (): Promise<RefsToBeArchived> => {
              const descriptor: Descriptor = {
                ...getMockDescriptor(),
                state,
                archivingSchedule: {
                  archivableOn: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
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

        const refs =
          await readModelService.getExpiredArchivableDescriptorRefs();
        expect(refs.length).toEqual(0);
      }
    );

    it("should return list of Descriptor refs only when is not in archiving state", async () => {
      const producerId: TenantId = generateId();

      const numberOfArchivableDescriptors = 5;
      const numberOfNonArchivableDescriptors = 5;

      const archivableRefs: RefsToBeArchived[] = await Promise.all(
        Array.from(
          { length: numberOfArchivableDescriptors },
          async (): Promise<RefsToBeArchived> => {
            const descriptor: Descriptor = {
              ...getMockDescriptor(),
              state: descriptorState.archiving,
              archivingSchedule: {
                archivableOn: new Date(Date.now() - 24 * 60 * 60 * 1000),
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
          async (): Promise<RefsToBeArchived> => {
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

      const refs = await readModelService.getExpiredArchivableDescriptorRefs();
      expect(refs).toEqual(expect.arrayContaining(archivableRefs));
      expect(archivableRefs).toEqual(expect.arrayContaining(refs));
    });
  });

  describe("getExpiredArchivableEserviceRefs", async () => {
    it("should return an array with all EServices to be archived", async () => {
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
              archivableOn: new Date(Date.now() - 24 * 60 * 60 * 1000),
              startedAt: new Date(toUTCMidnight(new Date(), -30)),
              scope: "EService",
            },
          };

          eservice.descriptors.push(descriptor);
        })
      );

      await addOneEService(eservice);

      const eserviceIds =
        await readModelService.getExpiredArchivableEserviceRefs();

      expect(eserviceIds).toEqual([eservice.id]);
    });

    it("should return an empty array when no eservices need to be archived", async () => {
      const producerId: TenantId = generateId();

      const nonExpiredDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.archiving,
        version: "1",
        archivingSchedule: {
          archivableOn: new Date(Date.now() + 24 * 60 * 60 * 1000),
          startedAt: new Date(toUTCMidnight(new Date(), -30)),
          scope: "EService",
        },
      };

      const nonExpiredEservice: EService = {
        ...getMockEService(),
        producerId,
        descriptors: [nonExpiredDescriptor],
      };

      const nonArchivingDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        version: "1",
      };

      const nonArchivingEservice: EService = {
        ...getMockEService(),
        producerId,
        descriptors: [nonArchivingDescriptor],
      };

      await addOneEService(nonExpiredEservice);
      await addOneEService(nonArchivingEservice);

      const eserviceIds =
        await readModelService.getExpiredArchivableEserviceRefs();

      expect(eserviceIds.length).toEqual(0);
    });
  });

  describe("getWrongEservices", async () => {
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
              archivableOn: new Date(Date.now() - 24 * 60 * 60 * 1000),
              startedAt: new Date(toUTCMidnight(new Date(), -30)),
              scope: "EService",
            },
          };

          eservice.descriptors.push(descriptor);
        })
      );

      await addOneEService(eservice);

      const testQuery = await readModelService.getWrongEservices([eservice.id]);

      expect(testQuery.length).toEqual(0);
    });

    it("should return an array with the list of wrong eservices", async () => {
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
              archivableOn: new Date(Date.now() - 24 * 60 * 60 * 1000),
              startedAt: new Date(toUTCMidnight(new Date(), -30)),
              scope: "EService",
            },
          };

          eservice.descriptors.push(descriptor);
        })
      );

      const expectedWrongDescriptors: Descriptor[] = [];

      await Promise.all(
        Array.from({ length: numberOfNonArchivableDescriptors }, async () => {
          i++;
          const descriptor: Descriptor = {
            ...getMockDescriptor(),
            state: descriptorState.published,
            version: i.toString(),
            archivingSchedule: {
              archivableOn: new Date(Date.now() - 24 * 60 * 60 * 1000),
              startedAt: new Date(toUTCMidnight(new Date(), -30)),
              scope: "EService",
            },
          };

          eservice.descriptors.push(descriptor);
          expectedWrongDescriptors.push(descriptor);
        })
      );

      await addOneEService(eservice);

      const testQuery = await readModelService.getWrongEservices([eservice.id]);

      expect(testQuery).toEqual([
        {
          eserviceId: eservice.id,
          wrongDescriptors: expectedWrongDescriptors.map((d) => ({
            id: d.id,
            state: d.state,
            scope: d.archivingSchedule?.scope,
          })),
        },
      ]);
      expect(testQuery[0].wrongDescriptors.length).toEqual(
        numberOfNonArchivableDescriptors
      );
    });
  });
});
