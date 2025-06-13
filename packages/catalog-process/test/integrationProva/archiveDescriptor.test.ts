/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContextInternal,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
  testCleanup,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorActivatedV2,
  toEServiceV2,
} from "pagopa-interop-models";
import { expect, describe, it, beforeEach, inject } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("archive descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();

  const readModelConfig = inject("readModelConfig");
  const eventStoreConfig = inject("eventStoreConfig");
  const fileManagerConfig = inject("fileManagerConfig");
  const emailManagerConfig = inject("emailManagerConfig");
  const redisRateLimiterConfig = inject("redisRateLimiterConfig");
  const awsSESConfig = inject("sesEmailManagerConfig");
  const readModelSQLConfig = inject("readModelSQLConfig");
  const analyticsSQLDbConfig = inject("analyticsSQLDbConfig");
  const tokenGenerationReadModelConfig = inject(
    "tokenGenerationReadModelConfig"
  ); // Per DynamoDB

  const allTestConfigs = {
    readModelConfig,
    eventStoreConfig,
    fileManagerConfig,
    emailManagerConfig,
    redisRateLimiterConfig,
    sesEmailManagerConfig: awsSESConfig,
    readModelSQLConfig,
    analyticsSQLDbConfig,
    tokenGenerationReadModelConfig, // Aggiungi questo se lo usi in setupTestContainersVitest
  };

  beforeEach(async () => {
    await testCleanup(allTestConfigs);
  });

  it("should write on event-store for the archiving of a descriptor", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.suspended,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    await catalogService.archiveDescriptor(
      eservice.id,
      descriptor.id,
      getMockContextInternal({})
    );

    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent.stream_id).toBe(eservice.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("EServiceDescriptorArchived");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorActivatedV2,
      payload: writtenEvent.data,
    });

    const expectedDescriptor = {
      ...descriptor,
      state: descriptorState.archived,
      archivedAt: new Date(
        Number(writtenPayload.eservice!.descriptors[0]!.archivedAt)
      ),
    };

    const expectedEService = toEServiceV2({
      ...eservice,
      descriptors: [expectedDescriptor],
    });
    expect(writtenPayload.eservice).toEqual(expectedEService);
    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    await expect(
      catalogService.archiveDescriptor(
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
      catalogService.archiveDescriptor(
        eservice.id,
        mockDescriptor.id,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });
});
