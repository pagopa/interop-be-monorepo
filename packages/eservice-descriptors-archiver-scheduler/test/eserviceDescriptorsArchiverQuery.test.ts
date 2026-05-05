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
  describe("getExpiredArchivableDescriptorRefs", async () => {});

  describe("getExpiredArchivableEserviceRefs", async () => {});

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
