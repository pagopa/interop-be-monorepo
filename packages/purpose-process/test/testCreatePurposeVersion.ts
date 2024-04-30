/* eslint-disable @typescript-eslint/no-floating-promises */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  getMockPurposeVersion,
  getMockPurpose,
  writeInReadmodel,
  readLastEventByStreamId,
  decodeProtobufPayload,
  getMockAgreement,
  getMockDescriptorPublished,
  getMockTenant,
  getMockValidRiskAnalysisForm,
} from "pagopa-interop-commons-test";
import {
  PurposeVersion,
  purposeVersionState,
  Purpose,
  toReadModelEService,
  generateId,
  toPurposeV2,
  Agreement,
  agreementState,
  EService,
  Tenant,
  PurposeActivatedV2,
  Descriptor,
} from "pagopa-interop-models";
import {
  organizationIsNotTheConsumer,
  unchangedDailyCalls,
} from "../src/model/domain/errors.js";
import { addOnePurpose, getMockEService } from "./utils.js";
import {
  postgresDB,
  purposes,
  eservices,
  purposeService,
  agreements,
  tenants,
} from "./purposeService.integration.test.js";

async function prepareForCreatePurposeVersionTest(options?: {
  descriptorDailyCallsPerConsumer?: number;
  descriptorDailyCallsTotal?: number;
}): Promise<{
  consumer: Tenant;
  producer: Tenant;
  mockEService: EService;
  mockAgreement: Agreement;
  mockPurpose: Purpose;
  mockPurposeVersion: PurposeVersion;
}> {
  const consumer: Tenant = { ...getMockTenant(), kind: "PA" };
  const producer: Tenant = { ...getMockTenant(), kind: "PA" };

  const dailyCallsPerConsumer =
    options?.descriptorDailyCallsPerConsumer ?? 1000;
  const dailyCallsTotal = options?.descriptorDailyCallsTotal ?? 2000;

  const mockEServiceDescriptor: Descriptor = {
    ...getMockDescriptorPublished(),
    dailyCallsPerConsumer,
    dailyCallsTotal,
  };
  const mockEService: EService = {
    ...getMockEService(),
    producerId: producer.id,
    descriptors: [mockEServiceDescriptor],
  };
  const mockAgreement: Agreement = {
    ...getMockAgreement(),
    eserviceId: mockEService.id,
    consumerId: consumer.id,
    descriptorId: mockEService.descriptors[0].id,
    state: agreementState.active,
  };
  const mockPurposeVersion: PurposeVersion = {
    ...getMockPurposeVersion(),
    state: purposeVersionState.active,
  };
  const mockPurpose: Purpose = {
    ...getMockPurpose(),
    riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
    consumerId: mockAgreement.consumerId,
    eserviceId: mockEService.id,
    versions: [mockPurposeVersion],
  };
  await addOnePurpose(mockPurpose, postgresDB, purposes);
  await writeInReadmodel(toReadModelEService(mockEService), eservices);
  await writeInReadmodel(mockAgreement, agreements);
  await writeInReadmodel(consumer, tenants);
  await writeInReadmodel(producer, tenants);

  return {
    consumer,
    producer,
    mockEService,
    mockAgreement,
    mockPurpose,
    mockPurposeVersion,
  };
}

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
        await prepareForCreatePurposeVersionTest();

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
      const { mockPurpose } = await prepareForCreatePurposeVersionTest();

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
        await prepareForCreatePurposeVersionTest();

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
      const consumer: Tenant = { ...getMockTenant(), kind: "PA" };
      const producer: Tenant = { ...getMockTenant(), kind: "PA" };

      const mockEServiceDescriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        dailyCallsPerConsumer: 99,
      };
      const mockEService: EService = {
        ...getMockEService(),
        producerId: producer.id,
        descriptors: [mockEServiceDescriptor],
      };
      const mockAgreement: Agreement = {
        ...getMockAgreement(),
        eserviceId: mockEService.id,
        consumerId: consumer.id,
        descriptorId: mockEService.descriptors[0].id,
        state: agreementState.active,
      };
      const mockPurposeVersion1: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.active,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
        consumerId: mockAgreement.consumerId,
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion1],
      };
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(producer, tenants);

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
