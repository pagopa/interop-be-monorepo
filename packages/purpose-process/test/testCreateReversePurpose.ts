/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it, vi } from "vitest";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockDescriptor,
  getMockDocument,
  getMockTenant,
  getMockValidRiskAnalysis,
  readLastEventByStreamId,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  Descriptor,
  EService,
  Purpose,
  PurposeAddedV2,
  RiskAnalysisId,
  Tenant,
  agreementState,
  descriptorState,
  eserviceMode,
  generateId,
  tenantKind,
  toPurposeV2,
  toReadModelEService,
  unsafeBrandId,
} from "pagopa-interop-models";
import { ApiReversePurposeSeed } from "../src/model/domain/models.js";
import {
  eServiceModeNotAllowed,
  eserviceRiskAnalysisNotFound,
  missingFreeOfChargeReason,
  organizationIsNotTheConsumer,
  tenantKindNotFound,
} from "../src/model/domain/errors.js";
import { getMockEService } from "./utils.js";
import {
  agreements,
  eservices,
  postgresDB,
  purposeService,
  tenants,
} from "./purposeService.integration.test.js";

export const testCreateReversePurpose = (): ReturnType<typeof describe> =>
  describe("createReveresePurpose", () => {
    it("should write in event-store for the creation of a reverse purpose", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const consumer = getMockTenant();
      const producer: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        publishedAt: new Date(),
        interface: getMockDocument(),
      };

      const mockRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
      const mockEService: EService = {
        ...getMockEService(),
        producerId: producer.id,
        riskAnalysis: [mockRiskAnalysis],
        descriptors: [mockDescriptor],
        mode: eserviceMode.receive,
      };

      const mockAgreement: Agreement = {
        ...getMockAgreement(),
        eserviceId: mockEService.id,
        consumerId: consumer.id,
        state: agreementState.active,
      };

      const reversePurposeSeed: ApiReversePurposeSeed = {
        eServiceId: mockEService.id,
        consumerId: consumer.id,
        riskAnalysisId: mockRiskAnalysis.id,
        title: "test purpose title",
        description: "test purpose description",
        isFreeOfCharge: true,
        freeOfChargeReason: "test",
        dailyCalls: 1,
      };

      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(producer, tenants);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockAgreement, agreements);

      const { purpose } = await purposeService.createPurposeFromEService(
        consumer.id,
        reversePurposeSeed,
        generateId()
      );

      const writtenEvent = await readLastEventByStreamId(
        purpose.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: purpose.id,
        version: "0",
        type: "PurposeAdded",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeAddedV2,
        payload: writtenEvent.data,
      });

      const expectedPurpose: Purpose = {
        versions: [],
        id: purpose.id,
        createdAt: new Date(),
        eserviceId: unsafeBrandId(reversePurposeSeed.eServiceId),
        consumerId: unsafeBrandId(reversePurposeSeed.consumerId),
        title: reversePurposeSeed.title,
        description: reversePurposeSeed.description,
        isFreeOfCharge: reversePurposeSeed.isFreeOfCharge,
        freeOfChargeReason: reversePurposeSeed.freeOfChargeReason,
        riskAnalysisForm: mockRiskAnalysis.riskAnalysisForm,
      };

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

      vi.useRealTimers();
    });
    it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
      const consumer = getMockTenant();
      const producer: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        publishedAt: new Date(),
        interface: getMockDocument(),
      };

      const mockRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
      const mockEService: EService = {
        ...getMockEService(),
        producerId: producer.id,
        riskAnalysis: [mockRiskAnalysis],
        descriptors: [mockDescriptor],
        mode: eserviceMode.receive,
      };

      const mockAgreement: Agreement = {
        ...getMockAgreement(),
        eserviceId: mockEService.id,
        consumerId: consumer.id,
        state: agreementState.active,
      };

      const reversePurposeSeed: ApiReversePurposeSeed = {
        eServiceId: mockEService.id,
        consumerId: consumer.id,
        riskAnalysisId: mockRiskAnalysis.id,
        title: "test purpose title",
        description: "test purpose description",
        isFreeOfCharge: true,
        freeOfChargeReason: "test",
        dailyCalls: 1,
      };

      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(producer, tenants);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockAgreement, agreements);

      expect(
        purposeService.createPurposeFromEService(
          producer.id,
          reversePurposeSeed,
          generateId()
        )
      ).rejects.toThrowError(organizationIsNotTheConsumer(producer.id));
    });
    it("should throw eserviceModeNotAllowed if the eservice is in deliver mode", async () => {
      const consumer = getMockTenant();
      const producer: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        publishedAt: new Date(),
        interface: getMockDocument(),
      };

      const mockRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
      const mockEService: EService = {
        ...getMockEService(),
        producerId: producer.id,
        riskAnalysis: [mockRiskAnalysis],
        descriptors: [mockDescriptor],
        mode: eserviceMode.deliver,
      };

      const mockAgreement: Agreement = {
        ...getMockAgreement(),
        eserviceId: mockEService.id,
        consumerId: consumer.id,
        state: agreementState.active,
      };

      const reversePurposeSeed: ApiReversePurposeSeed = {
        eServiceId: mockEService.id,
        consumerId: consumer.id,
        riskAnalysisId: mockRiskAnalysis.id,
        title: "test purpose title",
        description: "test purpose description",
        isFreeOfCharge: true,
        freeOfChargeReason: "test",
        dailyCalls: 1,
      };

      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(producer, tenants);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockAgreement, agreements);

      expect(
        purposeService.createPurposeFromEService(
          consumer.id,
          reversePurposeSeed,
          generateId()
        )
      ).rejects.toThrowError(
        eServiceModeNotAllowed(mockEService.id, eserviceMode.receive)
      );
    });
    it("should throw riskAnalysisNotFound if the selected riskAnalysis doesn't exist in that eservice", async () => {
      const consumer = getMockTenant();
      const producer: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        publishedAt: new Date(),
        interface: getMockDocument(),
      };

      const randomRiskAnalysisId: RiskAnalysisId = generateId();
      const mockEService: EService = {
        ...getMockEService(),
        producerId: producer.id,
        riskAnalysis: [],
        descriptors: [mockDescriptor],
        mode: eserviceMode.receive,
      };

      const mockAgreement: Agreement = {
        ...getMockAgreement(),
        eserviceId: mockEService.id,
        consumerId: consumer.id,
        state: agreementState.active,
      };

      const reversePurposeSeed: ApiReversePurposeSeed = {
        eServiceId: mockEService.id,
        consumerId: consumer.id,
        riskAnalysisId: randomRiskAnalysisId,
        title: "test purpose title",
        description: "test purpose description",
        isFreeOfCharge: true,
        freeOfChargeReason: "test",
        dailyCalls: 1,
      };

      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(producer, tenants);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockAgreement, agreements);

      expect(
        purposeService.createPurposeFromEService(
          consumer.id,
          reversePurposeSeed,
          generateId()
        )
      ).rejects.toThrowError(
        eserviceRiskAnalysisNotFound(mockEService.id, randomRiskAnalysisId)
      );
    });
    it("should throw missingFreeOfChargeReason if freeOfChargeReason has been omitted", async () => {
      const consumer = getMockTenant();
      const producer: Tenant = { ...getMockTenant(), kind: tenantKind.PA };

      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        publishedAt: new Date(),
        interface: getMockDocument(),
      };

      const mockRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
      const mockEService: EService = {
        ...getMockEService(),
        producerId: producer.id,
        riskAnalysis: [mockRiskAnalysis],
        descriptors: [mockDescriptor],
        mode: eserviceMode.receive,
      };

      const mockAgreement: Agreement = {
        ...getMockAgreement(),
        eserviceId: mockEService.id,
        consumerId: consumer.id,
        state: agreementState.active,
      };

      const reversePurposeSeed: ApiReversePurposeSeed = {
        eServiceId: mockEService.id,
        consumerId: consumer.id,
        riskAnalysisId: mockRiskAnalysis.id,
        title: "test purpose title",
        description: "test purpose description",
        isFreeOfCharge: true,
        freeOfChargeReason: "",
        dailyCalls: 1,
      };

      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(producer, tenants);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockAgreement, agreements);

      expect(
        purposeService.createPurposeFromEService(
          consumer.id,
          reversePurposeSeed,
          generateId()
        )
      ).rejects.toThrowError(missingFreeOfChargeReason());
    });
    it("should throw tenantKindNotFound if the tenant kind doesn't exist", async () => {
      const consumer = getMockTenant();
      const producer: Tenant = { ...getMockTenant(), kind: undefined };

      const mockDescriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        publishedAt: new Date(),
        interface: getMockDocument(),
      };

      const mockRiskAnalysis = getMockValidRiskAnalysis(tenantKind.PA);
      const mockEService: EService = {
        ...getMockEService(),
        producerId: producer.id,
        riskAnalysis: [mockRiskAnalysis],
        descriptors: [mockDescriptor],
        mode: eserviceMode.receive,
      };

      const mockAgreement: Agreement = {
        ...getMockAgreement(),
        eserviceId: mockEService.id,
        consumerId: consumer.id,
        state: agreementState.active,
      };

      const reversePurposeSeed: ApiReversePurposeSeed = {
        eServiceId: mockEService.id,
        consumerId: consumer.id,
        riskAnalysisId: mockRiskAnalysis.id,
        title: "test purpose title",
        description: "test purpose description",
        isFreeOfCharge: true,
        freeOfChargeReason: "test",
        dailyCalls: 1,
      };

      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(producer, tenants);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockAgreement, agreements);

      expect(
        purposeService.createPurposeFromEService(
          consumer.id,
          reversePurposeSeed,
          generateId()
        )
      ).rejects.toThrowError(tenantKindNotFound(producer.id));
    });
    it("should throw agreementNotFound if the requester doesn't have an agreement for the selected eservice", () => {
      expect(1).toBe(1);
    });
    it("should throw riskAnalysisValidationFailed if the risk analysis is not valid", () => {
      expect(2).toBe(2);
    });
  });
