/* eslint-disable @typescript-eslint/no-floating-promises */
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
  PurposeVersionRejectedV2,
  PurposeVersion,
  toPurposeV2,
  PurposeId,
  PurposeVersionId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  purposeNotFound,
  eserviceNotFound,
  organizationIsNotTheProducer,
  purposeVersionNotFound,
  notValidVersionState,
} from "../src/model/domain/errors.js";
import {
  postgresDB,
  purposes,
  eservices,
  purposeService,
} from "./purposeService.integration.test.js";
import { getMockEService, addOnePurpose } from "./utils.js";

export const testRejectPurposeVersion = (): ReturnType<typeof describe> =>
  describe("rejectPurposeVersion", () => {
    it("should write on event-store for the rejection of a purpose version", async () => {
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

      await purposeService.rejectPurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion.id,
        rejectionReason: "test",
        organizationId: mockEService.producerId,
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
        type: "PurposeVersionRejected",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeVersionRejectedV2,
        payload: writtenEvent.data,
      });

      const expectedPurposeVersion: PurposeVersion = {
        ...mockPurposeVersion,
        state: purposeVersionState.rejected,
        rejectionReason: "test",
        updatedAt: new Date(),
      };
      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [expectedPurposeVersion],
        updatedAt: new Date(),
      };

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

      vi.useRealTimers();
    });
    it("should throw purposeNotFound if the purpose doesn't exist", async () => {
      const mockEService = getMockEService();
      const mockPurposeVersion = getMockPurposeVersion();
      const randomId: PurposeId = generateId();
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.rejectPurposeVersion({
          purposeId: randomId,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
          organizationId: mockEService.producerId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(purposeNotFound(randomId));
    });
    it("Should throw eserviceNotFound if the eservice doesn't exist", async () => {
      const mockEService = getMockEService();
      const mockPurposeVersion = getMockPurposeVersion();
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);

      expect(
        purposeService.rejectPurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(eserviceNotFound(mockEService.id));
    });
    it("should throw organizationIsNotTheProducer if the requester is not the producer", async () => {
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
        purposeService.rejectPurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          rejectionReason: "test",
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(
        organizationIsNotTheProducer(mockPurpose.consumerId)
      );
    });
    it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
      const mockEService = getMockEService();
      const mockPurposeVersion = getMockPurposeVersion();
      const randomVersionId: PurposeVersionId = generateId();
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.rejectPurposeVersion({
          purposeId: mockPurpose.id,
          versionId: randomVersionId,
          rejectionReason: "test",
          organizationId: mockEService.producerId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(
        purposeVersionNotFound(mockPurpose.id, randomVersionId)
      );
    });
    it.each(
      Object.values(purposeVersionState).filter(
        (state) => state !== purposeVersionState.waitingForApproval
      )
    )(
      "should throw notValidVersionState if the purpose version is in %s state",
      async (state) => {
        const mockEService = getMockEService();
        const mockPurposeVersion = getMockPurposeVersion(state);

        const mockPurpose: Purpose = {
          ...getMockPurpose(),
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.rejectPurposeVersion({
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
            rejectionReason: "test",
            organizationId: mockEService.producerId,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(
          notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
        );
      }
    );
  });
