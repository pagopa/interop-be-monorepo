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
  RefreshableInteropToken,
  genericLogger,
  toUTCMidnight,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  Descriptor,
  TenantId,
  descriptorState,
  generateId,
} from "pagopa-interop-models";
import {
  CatalogProcessZodiosClient,
  catalogProcessClientBuilder,
} from "../src/services/catalogProcessClient.js";
import { eserviceDescriptorsArchiverSchedulerServiceBuilder } from "../src/services/eserviceDescriptorsArchiverSchedulerService.js";
import { RefsToBeArchived } from "../src/models/models.js";
import { addOneEService, readModelService } from "./utils.js";

describe("EService Descriptors Archiver Scheduler", async () => {
  describe("eserviceDescriptorsArchiverScheduler", async () => {
    const testCorrelationId: CorrelationId = generateId();
    const testToken = "mockToken";
    const testHeaders = {
      "X-Correlation-Id": testCorrelationId,
      Authorization: `Bearer ${testToken}`,
    };

    let catalogProcessClient: CatalogProcessZodiosClient;
    let mockRefreshableToken: RefreshableInteropToken;

    beforeAll(async () => {
      mockRefreshableToken = {
        get: () => Promise.resolve({ serialized: testToken }),
      } as RefreshableInteropToken;

      catalogProcessClient = catalogProcessClientBuilder("mockUrl");
    });

    beforeEach(async () => {
      // eslint-disable-next-line functional/immutable-data
      catalogProcessClient.archiveDescriptor = vi.fn();
    });

    afterEach(async () => {
      vi.clearAllMocks();
    });

    it.each([descriptorState.archiving, descriptorState.archivingSuspended])(
      "should call archive Descriptor when archivableOn is expired and state is %s",
      async (state) => {
        const producerId: TenantId = generateId();

        const numberOfArchivableDescriptors = 5;

        const refs: RefsToBeArchived[] = await Promise.all(
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
            "MANUAL",
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

    const notArchivingStates = [
      descriptorState.published,
      descriptorState.deprecated,
      descriptorState.suspended,
      descriptorState.archived,
      descriptorState.waitingForApproval,
      descriptorState.draft,
    ];

    it.each(notArchivingStates)(
      "should not call archive Descriptor when is in state %s",
      async (state) => {
        const producerId: TenantId = generateId();

        const numberOfNonArchivableDescriptors = 5;

        const nonArchivableRefs: RefsToBeArchived[] = await Promise.all(
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
          ).not.toHaveBeenCalledWith("MANUAL", {
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
      "should not call archive Descriptor when archivableOn is not expired and in state %s",
      async (state) => {
        const producerId: TenantId = generateId();

        const numberOfNonArchivableDescriptors = 5;

        const nonArchivableRefs: RefsToBeArchived[] = await Promise.all(
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
          ).not.toHaveBeenCalledWith("MANUAL", {
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

      const nonArchivableRefs: RefsToBeArchived[] = await Promise.all(
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
          "MANUAL",
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
          "MANUAL",
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
  });
});
