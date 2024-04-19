/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it, vi } from "vitest";
import {
  getMockPurposeVersion,
  getMockPurpose,
  writeInReadmodel,
  readLastEventByStreamId,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test/index.js";
import {
  purposeVersionState,
  Purpose,
  toReadModelEService,
  generateId,
  WaitingForApprovalPurposeVersionDeletedV2,
  toPurposeV2,
  PurposeId,
  PurposeVersionId,
  PurposeVersion,
} from "pagopa-interop-models";
import {
  purposeNotFound,
  purposeVersionNotFound,
  organizationIsNotTheConsumer,
  purposeVersionCannotBeDeleted,
} from "../src/model/domain/errors.js";
import { addOnePurpose, getMockEService } from "./utils.js";
import {
  postgresDB,
  purposes,
  eservices,
  purposeService,
} from "./purposeService.integration.test.js";

export const testDeletePurposeVersion = (): ReturnType<typeof describe> =>
  describe("deletePurposeVersion", () => {
    it("should write in event-store for the deletion of a purpose version", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const mockEService = getMockEService();
      const mockPurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.waitingForApproval,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      await purposeService.deletePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
      });

      const writtenEvent = await readLastEventByStreamId(
        mockPurpose.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "1",
        type: "WaitingForApprovalPurposeVersionDeleted",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: WaitingForApprovalPurposeVersionDeletedV2,
        payload: writtenEvent.data,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [],
        updatedAt: new Date(),
      };

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

      vi.useRealTimers();
    });
    it("should throw purposeNotFound if the purpose doesn't exist", async () => {
      const randomId: PurposeId = generateId();
      const mockEService = getMockEService();
      const mockPurposeVersion = getMockPurposeVersion();
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.deletePurposeVersion({
          purposeId: randomId,
          versionId: mockPurposeVersion.id,
          organizationId: mockEService.producerId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(purposeNotFound(randomId));
    });
    it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
      const randomVersionId: PurposeVersionId = generateId();
      const mockEService = getMockEService();
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [getMockPurposeVersion()],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.deletePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: randomVersionId,
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(
        purposeVersionNotFound(mockPurpose.id, randomVersionId)
      );
    });
    it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
      const mockEService = getMockEService();
      const mockPurposeVersion = getMockPurposeVersion();
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.deletePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockEService.producerId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(
        organizationIsNotTheConsumer(mockEService.producerId)
      );
    });
    it.each(
      Object.values(purposeVersionState).filter(
        (state) => state !== purposeVersionState.waitingForApproval
      )
    )(
      "should throw purposeVersionCannotBeDeleted if the purpose version is in %s state",
      async (state) => {
        const mockPurposeVersion: PurposeVersion = {
          ...getMockPurposeVersion(state),
        };
        const mockEService = getMockEService();
        const mockPurpose: Purpose = {
          ...getMockPurpose(),
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurposeVersion({
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
            organizationId: mockPurpose.consumerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          purposeVersionCannotBeDeleted(mockPurpose.id, mockPurposeVersion.id)
        );
      }
    );
  });
