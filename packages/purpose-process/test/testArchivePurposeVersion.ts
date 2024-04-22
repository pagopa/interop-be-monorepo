/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockPurposeVersion,
  getMockPurpose,
  readLastEventByStreamId,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test/index.js";
import {
  PurposeVersion,
  purposeVersionState,
  Purpose,
  generateId,
  PurposeArchivedV2,
  toPurposeV2,
  PurposeId,
  PurposeVersionId,
  TenantId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  purposeNotFound,
  organizationIsNotTheConsumer,
  purposeVersionNotFound,
  notValidVersionState,
} from "../src/model/domain/errors.js";
import {
  postgresDB,
  purposes,
  purposeService,
} from "./purposeService.integration.test.js";
import { addOnePurpose } from "./utils.js";

export const testArchivePurposeVersion = (): ReturnType<typeof describe> =>
  describe("archivePurposeVersion", () => {
    it("should write on event-store for the archiving of a purpose version", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const mockPurposeVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.active,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        versions: [mockPurposeVersion],
      };
      await addOnePurpose(mockPurpose, postgresDB, purposes);

      await purposeService.archivePurposeVersion({
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
        type: "PurposeArchived",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [
          {
            ...mockPurposeVersion,
            state: purposeVersionState.rejected,
            updatedAt: new Date(),
          },
        ],
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeArchivedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

      vi.useRealTimers();
    });
    it("should write on event-store for the archiving of a purpose version, and delete waitingForApproval versions", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const mockPurposeVersion1: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.active,
      };
      const mockPurposeVersion2: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.waitingForApproval,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        versions: [mockPurposeVersion1, mockPurposeVersion2],
      };
      await addOnePurpose(mockPurpose, postgresDB, purposes);

      await purposeService.archivePurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
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
        type: "PurposeArchived",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [
          {
            ...mockPurposeVersion1,
            state: purposeVersionState.rejected,
            updatedAt: new Date(),
          },
        ],
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeArchivedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

      vi.useRealTimers();
    });
    it("should throw purposeNotFound if the purpose doesn't exist", async () => {
      const randomPurposeId: PurposeId = generateId();
      const randomVersionId: PurposeVersionId = generateId();
      const mockPurpose = getMockPurpose();
      await addOnePurpose(mockPurpose, postgresDB, purposes);

      expect(
        purposeService.archivePurposeVersion({
          purposeId: randomPurposeId,
          versionId: randomVersionId,
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(purposeNotFound(randomPurposeId));
    });
    it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
      const randomOrganizationId: TenantId = generateId();

      const mockPurposeVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.active,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);

      expect(
        purposeService.archivePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: randomOrganizationId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(
        organizationIsNotTheConsumer(randomOrganizationId)
      );
    });
    it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
      const randomVersionId: PurposeVersionId = generateId();
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        versions: [],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);

      expect(
        purposeService.archivePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: randomVersionId,
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(
        purposeVersionNotFound(mockPurpose.id, randomVersionId)
      );
    });
    it("should throw notValidVersionState if the purpose version is in draft state", async () => {
      const mockPurposeVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.draft,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);

      expect(
        purposeService.archivePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(
        notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
      );
    });
    it("should throw notValidVersionState if the purpose version is in waitingForApproval state", async () => {
      const mockPurposeVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.waitingForApproval,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);

      expect(
        purposeService.archivePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(
        notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
      );
    });
    it("should throw notValidVersionState if the purpose version is in rejected state", async () => {
      const mockPurposeVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.rejected,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);

      expect(
        purposeService.archivePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(
        notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
      );
    });
  });
