/* eslint-disable @typescript-eslint/no-floating-promises */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  readLastEventByStreamId,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test";
import {
  purposeVersionState,
  Purpose,
  generateId,
  toPurposeV2,
  PurposeActivatedV2,
} from "pagopa-interop-models";
import {
  organizationIsNotTheConsumer,
  unchangedDailyCalls,
} from "../src/model/domain/errors.js";
import { prepareReadModelForPurposeTest } from "./utils.js";
import {
  postgresDB,
  purposeService,
} from "./purposeService.integration.test.js";

export const testCreatePurposeVersion = (): ReturnType<typeof describe> =>
  describe("createPurposeVersion", () => {
    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
    });

    afterAll(() => {
      vi.useRealTimers();
    });
    it("should write on event-store for the creation of a new purpose version", async () => {
      const { mockPurpose, mockPurposeVersion } =
        await prepareReadModelForPurposeTest();

      const purposeVersion = await purposeService.createPurposeVersion({
        purposeId: mockPurpose.id,
        seed: {
          dailyCalls: 20,
        },
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
        type: "PurposeActivated",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [
          {
            ...mockPurposeVersion,
            state: purposeVersionState.archived,
            updatedAt: new Date(),
          },
          purposeVersion,
        ],
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeActivatedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    });

    it("should throw an error if the new request daily calls are the same of the previous version", async () => {
      const { mockPurpose } = await prepareReadModelForPurposeTest();

      expect(
        async () =>
          await purposeService.createPurposeVersion({
            purposeId: mockPurpose.id,
            seed: {
              dailyCalls: 10,
            },
            organizationId: mockPurpose.consumerId,
            correlationId: generateId(),
          })
      ).rejects.toThrowError(unchangedDailyCalls(mockPurpose.id));
    });

    it("should throw an error if the caller is not the consumer", async () => {
      const { mockPurpose, mockEService } =
        await prepareReadModelForPurposeTest();

      expect(async () => {
        await purposeService.createPurposeVersion({
          purposeId: mockPurpose.id,
          seed: {
            dailyCalls: 1000,
          },
          organizationId: mockEService.producerId,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(
        organizationIsNotTheConsumer(mockEService.producerId)
      );
    });

    it("should create a new purpose waiting for approval version if the new version surpasses the e-service daily calls per consumer limit", async () => {
      const { mockPurpose } = await prepareReadModelForPurposeTest({
        eserviceDescriptor: { dailyCallsPerConsumer: 99 },
      });

      const purposeVersion = await purposeService.createPurposeVersion({
        purposeId: mockPurpose.id,
        seed: {
          dailyCalls: 1000,
        },
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
      });

      expect(purposeVersion.state).toEqual(
        purposeVersionState.waitingForApproval
      );
    });
  });
