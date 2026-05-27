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
import { RefreshableInteropToken, genericLogger } from "pagopa-interop-commons";
import {
  CorrelationId,
  Descriptor,
  DescriptorState,
  EService,
  EServiceId,
  TenantId,
  descriptorState,
  generateId,
} from "pagopa-interop-models";
import {
  CatalogProcessZodiosClient,
  catalogProcessClientBuilder,
} from "../src/services/catalogProcessClient.js";
import { eserviceDescriptorsArchiverSchedulerServiceBuilder } from "../src/services/eserviceDescriptorsArchiverSchedulerService.js";
import { ArchivableDescriptorRef } from "../src/models/models.js";
import { addOneEService, readModelService, toUTCMidnight } from "./utils.js";

describe("EService Descriptors Archiver Scheduler", async () => {
  const testCorrelationId: CorrelationId = generateId();
  const testToken = "mockToken";
  const testHeaders = {
    "X-Correlation-Id": testCorrelationId,
    Authorization: `Bearer ${testToken}`,
  };
  const manualPayload = {
    kind: "MANUAL",
  };

  let catalogProcessClient: CatalogProcessZodiosClient;
  let mockRefreshableToken: RefreshableInteropToken;

  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as typeof genericLogger;

  beforeAll(async () => {
    mockRefreshableToken = {
      get: () => Promise.resolve({ serialized: testToken }),
    } as RefreshableInteropToken;

    catalogProcessClient = catalogProcessClientBuilder("mockUrl");
  });

  beforeEach(async () => {
    // eslint-disable-next-line functional/immutable-data
    catalogProcessClient.archiveDescriptor = vi.fn();
    catalogProcessClient.archiveEService = vi.fn();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  const notArchivingStates = [
    descriptorState.published,
    descriptorState.deprecated,
    descriptorState.suspended,
    descriptorState.archived,
    descriptorState.waitingForApproval,
    descriptorState.draft,
  ];

  describe("archiveDescriptors", async () => {
    it.each([descriptorState.archiving, descriptorState.archivingSuspended])(
      "should call archive Descriptor when archivableOn is archivable and state is %s",
      async (state) => {
        const producerId: TenantId = generateId();

        const numberOfArchivableDescriptors = 5;

        const refs: ArchivableDescriptorRef[] = await Promise.all(
          Array.from(
            { length: numberOfArchivableDescriptors },
            async (): Promise<ArchivableDescriptorRef> => {
              const descriptor: Descriptor = {
                ...getMockDescriptor(),
                state,
                archivingSchedule: {
                  archivableOn: new Date(toUTCMidnight(new Date(), 0)),
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

        const archiverService =
          eserviceDescriptorsArchiverSchedulerServiceBuilder({
            readModelService,
            catalogProcessClient: catalogProcessClient,
            loggerInstance: genericLogger,
            refreshableToken: mockRefreshableToken,
          });
        await archiverService.archiveDescriptors();

        refs.forEach((ref) => {
          expect(catalogProcessClient.archiveDescriptor).toHaveBeenCalledWith(
            manualPayload,
            {
              params: {
                eServiceId: ref.eserviceId,
                descriptorId: ref.descriptorId,
              },
              headers: expect.objectContaining({
                ...testHeaders,
                "X-Correlation-Id": expect.any(String),
              }),
            }
          );
        });
        expect(catalogProcessClient.archiveDescriptor).toHaveBeenCalledTimes(
          numberOfArchivableDescriptors
        );
      }
    );

    it.each(notArchivingStates)(
      "should not call archive Descriptor when is in state %s",
      async (state) => {
        const producerId: TenantId = generateId();

        const numberOfNonArchivableDescriptors = 5;

        const nonArchivableRefs: ArchivableDescriptorRef[] = await Promise.all(
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

        const archiverService =
          eserviceDescriptorsArchiverSchedulerServiceBuilder({
            readModelService,
            catalogProcessClient: catalogProcessClient,
            loggerInstance: genericLogger,
            refreshableToken: mockRefreshableToken,
          });
        await archiverService.archiveDescriptors();

        nonArchivableRefs.forEach((ref) => {
          expect(
            catalogProcessClient.archiveDescriptor
          ).not.toHaveBeenCalledWith(manualPayload, {
            params: {
              eServiceId: ref.eserviceId,
              descriptorId: ref.descriptorId,
            },
            headers: expect.objectContaining({
              ...testHeaders,
              "X-Correlation-Id": expect.any(String),
            }),
          });
        });

        expect(catalogProcessClient.archiveDescriptor).toHaveBeenCalledTimes(0);
      }
    );

    it.each([descriptorState.archiving, descriptorState.archivingSuspended])(
      "should not call archive Descriptor when archivableOn is not archivable and in state %s",
      async (state) => {
        const producerId: TenantId = generateId();

        const numberOfNonArchivableDescriptors = 5;

        const nonArchivableRefs: ArchivableDescriptorRef[] = await Promise.all(
          Array.from(
            { length: numberOfNonArchivableDescriptors },
            async (): Promise<ArchivableDescriptorRef> => {
              const descriptor: Descriptor = {
                ...getMockDescriptor(),
                state,
                archivingSchedule: {
                  archivableOn: new Date(toUTCMidnight(new Date(), 1)),
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

        const archiverService =
          eserviceDescriptorsArchiverSchedulerServiceBuilder({
            readModelService,
            catalogProcessClient: catalogProcessClient,
            loggerInstance: genericLogger,
            refreshableToken: mockRefreshableToken,
          });
        await archiverService.archiveDescriptors();

        nonArchivableRefs.forEach((ref) => {
          expect(
            catalogProcessClient.archiveDescriptor
          ).not.toHaveBeenCalledWith(manualPayload, {
            params: {
              eServiceId: ref.eserviceId,
              descriptorId: ref.descriptorId,
            },
            headers: expect.objectContaining({
              ...testHeaders,
              "X-Correlation-Id": expect.any(String),
            }),
          });
        });
        expect(catalogProcessClient.archiveDescriptor).toHaveBeenCalledTimes(0);
      }
    );

    it("should not call archive Descriptor when is not in archiving state", async () => {
      const producerId: TenantId = generateId();

      const numberOfArchivableDescriptors = 5;
      const numberOfNonArchivableDescriptors = 5;

      const archivableRefs: ArchivableDescriptorRef[] = await Promise.all(
        Array.from(
          { length: numberOfArchivableDescriptors },
          async (): Promise<ArchivableDescriptorRef> => {
            const descriptor: Descriptor = {
              ...getMockDescriptor(),
              state: descriptorState.archiving,
              archivingSchedule: {
                archivableOn: new Date(toUTCMidnight(new Date(), 0)),
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

      const nonArchivableRefs: ArchivableDescriptorRef[] = await Promise.all(
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

      const archiverService =
        eserviceDescriptorsArchiverSchedulerServiceBuilder({
          readModelService,
          catalogProcessClient: catalogProcessClient,
          loggerInstance: genericLogger,
          refreshableToken: mockRefreshableToken,
        });
      await archiverService.archiveDescriptors();

      archivableRefs.forEach((ref) => {
        expect(catalogProcessClient.archiveDescriptor).toHaveBeenCalledWith(
          manualPayload,
          {
            params: {
              eServiceId: ref.eserviceId,
              descriptorId: ref.descriptorId,
            },
            headers: expect.objectContaining({
              ...testHeaders,
              "X-Correlation-Id": expect.any(String),
            }),
          }
        );
      });

      nonArchivableRefs.forEach((ref) => {
        expect(catalogProcessClient.archiveDescriptor).not.toHaveBeenCalledWith(
          manualPayload,
          {
            params: {
              eServiceId: ref.eserviceId,
              descriptorId: ref.descriptorId,
            },
            headers: expect.objectContaining({
              ...testHeaders,
              "X-Correlation-Id": expect.any(String),
            }),
          }
        );
      });

      expect(catalogProcessClient.archiveDescriptor).toHaveBeenCalledTimes(
        numberOfArchivableDescriptors
      );
    });

    it("should call archive Descriptor for all descriptors regardless of errors", async () => {
      const producerId: TenantId = generateId();

      const numberOfArchivableDescriptors = 10;
      const rejectIds: ArchivableDescriptorRef[] = [];

      const refs: ArchivableDescriptorRef[] = await Promise.all(
        Array.from(
          { length: numberOfArchivableDescriptors },
          async (_, idx): Promise<ArchivableDescriptorRef> => {
            const descriptor: Descriptor = {
              ...getMockDescriptor(),
              state: descriptorState.archiving,
              archivingSchedule: {
                archivableOn: new Date(toUTCMidnight(new Date(), 0)),
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

            // Reject every second descriptor
            if (idx % 2 === 0) {
              rejectIds.push({
                eserviceId: eservice.id,
                descriptorId: descriptor.id,
              });
            }

            return {
              eserviceId: eservice.id,
              descriptorId: descriptor.id,
            };
          }
        )
      );

      expect(refs.length).toBe(numberOfArchivableDescriptors);
      expect(rejectIds.length).toBe(numberOfArchivableDescriptors / 2);
      expect(refs.length).toBeGreaterThan(0);
      expect(rejectIds.length).toBeGreaterThan(0);

      catalogProcessClient.archiveDescriptor = vi.fn((_, { params }) => {
        if (
          rejectIds.some(
            ({ eserviceId, descriptorId }) =>
              eserviceId === params.eServiceId &&
              descriptorId === params.descriptorId
          )
        ) {
          const err = new Error("somethingWrong");
          return Promise.reject(err);
        } else {
          return Promise.resolve();
        }
      });

      const archiverService =
        eserviceDescriptorsArchiverSchedulerServiceBuilder({
          readModelService,
          catalogProcessClient: catalogProcessClient,
          loggerInstance: mockLogger,
          refreshableToken: mockRefreshableToken,
        });
      await archiverService.archiveDescriptors();

      refs.forEach((ref) => {
        expect(catalogProcessClient.archiveDescriptor).toHaveBeenCalledWith(
          manualPayload,
          {
            params: {
              eServiceId: ref.eserviceId,
              descriptorId: ref.descriptorId,
            },
            headers: expect.objectContaining({
              ...testHeaders,
              "X-Correlation-Id": expect.any(String),
            }),
          }
        );
      });
      expect(catalogProcessClient.archiveDescriptor).toHaveBeenCalledTimes(
        numberOfArchivableDescriptors
      );

      expect(mockLogger.error).toHaveBeenCalledTimes(rejectIds.length);

      rejectIds.forEach((ref) => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            `Error while archiving descriptor with id ${ref.descriptorId} of e-service with id ${ref.eserviceId}:`
          )
        );
      });
    });
  });

  describe("archiveEServices", async () => {
    it.each([descriptorState.archiving, descriptorState.archivingSuspended])(
      "should call archive EService when archivableOn is archivable and state is %s",
      async (state) => {
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
                archivableOn: new Date(toUTCMidnight(new Date(), 0)),
                startedAt: new Date(toUTCMidnight(new Date(), -30)),
                scope: "EService",
              },
            };

            eservice.descriptors.push(descriptor);
          })
        );

        await addOneEService(eservice);

        const archiverService =
          eserviceDescriptorsArchiverSchedulerServiceBuilder({
            readModelService,
            catalogProcessClient: catalogProcessClient,
            loggerInstance: genericLogger,
            refreshableToken: mockRefreshableToken,
          });
        await archiverService.archiveEServices();

        expect(catalogProcessClient.archiveEService).toHaveBeenCalledWith(
          undefined,
          {
            params: {
              eServiceId: eservice.id,
            },
            headers: expect.objectContaining({
              ...testHeaders,
              "X-Correlation-Id": expect.any(String),
            }),
          }
        );

        expect(catalogProcessClient.archiveEService).toHaveBeenCalledTimes(1);
      }
    );

    it.each([descriptorState.archiving, descriptorState.archivingSuspended])(
      "should not call archive EService when archivableOn is not archivable and state is %s",
      async (state) => {
        const producerId: TenantId = generateId();

        const nonArchivableDescriptor: Descriptor = {
          ...getMockDescriptor(),
          state,
          version: "1",
          archivingSchedule: {
            archivableOn: new Date(toUTCMidnight(new Date(), 1)),
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
          state: descriptorState.published,
          version: "1",
        };

        const nonArchivingEservice: EService = {
          ...getMockEService(),
          producerId,
          descriptors: [nonArchivingDescriptor],
        };

        await addOneEService(nonArchivableEservice);
        await addOneEService(nonArchivingEservice);

        const archiverService =
          eserviceDescriptorsArchiverSchedulerServiceBuilder({
            readModelService,
            catalogProcessClient: catalogProcessClient,
            loggerInstance: genericLogger,
            refreshableToken: mockRefreshableToken,
          });
        await archiverService.archiveEServices();

        expect(catalogProcessClient.archiveEService).not.toHaveBeenCalledWith(
          undefined,
          {
            params: {
              eServiceId: nonArchivableEservice.id,
            },
            headers: expect.objectContaining({
              ...testHeaders,
              "X-Correlation-Id": expect.any(String),
            }),
          }
        );

        expect(catalogProcessClient.archiveEService).toHaveBeenCalledTimes(0);
      }
    );

    it("should call archiveEService for all EServices regardless of errors", async () => {
      const producerId: TenantId = generateId();

      const numberOfArchivableEServices = 10;
      const rejectIds: EServiceId[] = [];

      const refs: EServiceId[] = await Promise.all(
        Array.from(
          { length: numberOfArchivableEServices },
          async (_, idx): Promise<EServiceId> => {
            const eservice: EService = {
              ...getMockEService(),
              producerId,
              descriptors: [
                {
                  ...getMockDescriptor(),
                  state: descriptorState.archiving,
                  archivingSchedule: {
                    archivableOn: new Date(toUTCMidnight(new Date(), -1)),
                    startedAt: new Date(toUTCMidnight(new Date(), -30)),
                    scope: "EService",
                  },
                },
              ],
            };

            // Reject every second EService
            if (idx % 2 === 0) {
              rejectIds.push(eservice.id);
            }

            await addOneEService(eservice);

            return eservice.id;
          }
        )
      );

      expect(refs.length).toBe(numberOfArchivableEServices);
      expect(rejectIds.length).toBe(numberOfArchivableEServices / 2);
      expect(refs.length).toBeGreaterThan(0);
      expect(rejectIds.length).toBeGreaterThan(0);

      // Mock ArchiveEService to reject every second EService
      catalogProcessClient.archiveEService = vi.fn((_, { params }) => {
        if (rejectIds.some((eserviceId) => eserviceId === params.eServiceId)) {
          const err = new Error("somethingWrong");
          return Promise.reject(err);
        }

        return Promise.resolve();
      });

      const archiverService =
        eserviceDescriptorsArchiverSchedulerServiceBuilder({
          readModelService,
          catalogProcessClient: catalogProcessClient,
          loggerInstance: mockLogger,
          refreshableToken: mockRefreshableToken,
        });
      await archiverService.archiveEServices();

      refs.forEach((eServiceId) => {
        expect(catalogProcessClient.archiveEService).toHaveBeenCalledWith(
          undefined,
          {
            params: {
              eServiceId,
            },
            headers: expect.objectContaining({
              ...testHeaders,
              "X-Correlation-Id": expect.any(String),
            }),
          }
        );
      });

      expect(catalogProcessClient.archiveEService).toHaveBeenCalledTimes(
        numberOfArchivableEServices
      );

      expect(mockLogger.error).toHaveBeenCalledTimes(rejectIds.length);

      rejectIds.forEach((eserviceId) => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            `Error while archiving e-service with id ${eserviceId}`
          )
        );
      });
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
      "should not call archiveEservice and correctly warn about unarchivable eservices if one of their descriptor has state %s",
      async (state) => {
        const producerId: TenantId = generateId();

        const numberOfArchivableDescriptors = 5;
        const numberOfNonArchivableDescriptors = 5;

        const unarchivableEservice: EService = {
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

            unarchivableEservice.descriptors.push(descriptor);
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

            unarchivableEservice.descriptors.push(descriptor);
            expectedUnarchivableDescriptors.push(descriptor);
          })
        );

        await addOneEService(unarchivableEservice);

        const archiverService =
          eserviceDescriptorsArchiverSchedulerServiceBuilder({
            readModelService,
            catalogProcessClient: catalogProcessClient,
            loggerInstance: mockLogger,
            refreshableToken: mockRefreshableToken,
          });
        await archiverService.archiveEServices();

        expect(catalogProcessClient.archiveEService).not.toHaveBeenCalledWith(
          undefined,
          {
            params: {
              eServiceId: unarchivableEservice.id,
            },
            headers: expect.objectContaining({
              ...testHeaders,
              "X-Correlation-Id": expect.any(String),
            }),
          }
        );

        expect(catalogProcessClient.archiveEService).toHaveBeenCalledTimes(0);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "Found 1 e-services with unarchivable descriptors to be archived..."
          )
        );

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            `e-service with id ${unarchivableEservice.id} has unarchivable descriptors`
          )
        );
      }
    );
  });
});
