/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  MaintenanceEServicePersonalDataFlagResetV2,
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

describe("maintenanceResetEServicePersonalDataFlag", async () => {
  const mockMaintenanceMessage = "Reset personalData flag for maintenance";

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should write on event-store for the reset of personalData flag", async () => {
    const mockEService: EService = {
      ...getMockEService(),
      descriptors: [getMockDescriptorPublished()],
      personalData: true,
    };
    await addOneEService(mockEService);
    await catalogService.maintenanceResetEServicePersonalDataFlag(
      mockEService.id,
      mockMaintenanceMessage,
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
      type: "MaintenanceEServicePersonalDataFlagReset",
      event_version: 2,
    });
    const writtenPayload:
      | MaintenanceEServicePersonalDataFlagResetV2
      | undefined = protobufDecoder(
      MaintenanceEServicePersonalDataFlagResetV2
    ).parse(writtenEvent.data);

    const updatedMockEService: EService = {
      ...mockEService,
      personalData: undefined,
    };
    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedMockEService));
    expect(writtenPayload.reason).toBe(mockMaintenanceMessage);
  });

  it("should throw eserviceNotFound when the eservice doesn't exist", async () => {
    const mockEService = getMockEService();

    await expect(
      catalogService.maintenanceResetEServicePersonalDataFlag(
        mockEService.id,
        mockMaintenanceMessage,
        getMockContextMaintenance({})
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eserviceInDraftState when the eservice is in draft", async () => {
    const mockEService: EService = { ...getMockEService(), descriptors: [] };
    await addOneEService(mockEService);

    await expect(
      catalogService.maintenanceResetEServicePersonalDataFlag(
        mockEService.id,
        mockMaintenanceMessage,
        getMockContextMaintenance({})
      )
    ).rejects.toThrowError(eserviceInDraftState(mockEService.id));
  });
});
