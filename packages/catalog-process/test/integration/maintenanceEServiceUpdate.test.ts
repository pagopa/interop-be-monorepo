/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  MaintenanceEServiceUpdatedV2,
  EService,
  protobufDecoder,
  toEServiceV2,
} from "pagopa-interop-models";
import { describe, it, expect, beforeAll, vi, afterAll } from "vitest";
import {
  getMockContextMaintenance,
  getMockDescriptorPublished,
  getMockEService,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import {
  eserviceInDraftState,
  eServiceNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  postgresDB,
  catalogService,
} from "../integrationUtils.js";
import { catalogApi } from "pagopa-interop-api-clients";

describe("maintenanceEServiceUpdate", async () => {
  const mockUpdateSeed: catalogApi.MaintenanceEServiceUpdatePayload = {
    currentVersion: 0,
    eservice: { personalData: false },
  };

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the update of an eservice", async () => {
    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [getMockDescriptorPublished()],
    };
    await addOneEService(mockEService);
    await catalogService.maintenanceUpdateEService(
      {
        eserviceId: mockEService.id,
        maintenanceSeed: mockUpdateSeed,
      },
      getMockContextMaintenance({})
    );
    const writtenEvent = await readLastEventByStreamId(
      mockEService.id,
      "catalog",
      postgresDB
    );

    expect(writtenEvent).toMatchObject({
      stream_id: mockEService.id,
      version: "1",
      type: "MaintenanceEServiceUpdated",
      event_version: 2,
    });
    const writtenPayload: MaintenanceEServiceUpdatedV2 | undefined =
      protobufDecoder(MaintenanceEServiceUpdatedV2).parse(writtenEvent.data);

    const updatedMockEService: EService = {
      ...mockEService,
      personalData: mockUpdateSeed.eservice.personalData!,
    };
    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedMockEService));
  });

  it("should throw eserviceNotFound when the eservice doesn't exist", async () => {
    const mockEService = getMockEService();

    await expect(
      catalogService.maintenanceUpdateEService(
        {
          eserviceId: mockEService.id,
          maintenanceSeed: mockUpdateSeed,
        },
        getMockContextMaintenance({})
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eserviceInDraftState when the eservice is in draft", async () => {
    const mockEService: EService = { ...getMockEService(), descriptors: [] };
    await addOneEService(mockEService);

    await expect(
      catalogService.maintenanceUpdateEService(
        {
          eserviceId: mockEService.id,
          maintenanceSeed: mockUpdateSeed,
        },
        getMockContextMaintenance({})
      )
    ).rejects.toThrowError(eserviceInDraftState(mockEService.id));
  });

  it("should remove personalData when set to null", async () => {
    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [getMockDescriptorPublished()],
      personalData: true,
    };
    await addOneEService(mockEService);
    const updateSeed: catalogApi.MaintenanceEServiceUpdatePayload = {
      currentVersion: 0,
      eservice: { personalData: null },
    };
    await catalogService.maintenanceUpdateEService(
      {
        eserviceId: mockEService.id,
        maintenanceSeed: updateSeed,
      },
      getMockContextMaintenance({})
    );
    const writtenEvent = await readLastEventByStreamId(
      mockEService.id,
      "catalog",
      postgresDB
    );

    const writtenPayload: MaintenanceEServiceUpdatedV2 | undefined =
      protobufDecoder(MaintenanceEServiceUpdatedV2).parse(writtenEvent.data);

    expect(writtenPayload.eservice?.personalData).toBeUndefined();
  });
});
