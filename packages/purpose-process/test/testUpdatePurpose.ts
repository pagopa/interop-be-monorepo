/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { unexpectedRulesVersionError } from "pagopa-interop-commons";
import {
  randomArrayItem,
  getMockTenant,
  getMockPurpose,
  getMockPurposeVersion,
  getMockValidRiskAnalysisForm,
  getMockValidRiskAnalysis,
  writeInReadmodel,
  readLastEventByStreamId,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test/index.js";
import {
  tenantKind,
  Tenant,
  EService,
  Purpose,
  purposeVersionState,
  generateId,
  toReadModelEService,
  DraftPurposeUpdatedV2,
  toPurposeV2,
  PurposeId,
  unsafeBrandId,
  TenantId,
  EServiceId,
  RiskAnalysis,
  eserviceMode,
} from "pagopa-interop-models";
import { describe, it, expect, vi } from "vitest";
import {
  purposeNotFound,
  organizationIsNotTheConsumer,
  purposeNotInDraftState,
  eserviceNotFound,
  eServiceModeNotAllowed,
  missingFreeOfChargeReason,
  tenantNotFound,
  tenantKindNotFound,
  riskAnalysisValidationFailed,
} from "../src/model/domain/errors.js";
import {
  ApiPurposeUpdateContent,
  ApiReversePurposeUpdateContent,
} from "../src/model/domain/models.js";
import {
  postgresDB,
  purposes,
  eservices,
  tenants,
  purposeService,
} from "./purposeService.integration.test.js";
import {
  getMockEService,
  buildRiskAnalysisSeed,
  addOnePurpose,
  createUpdatedPurpose,
} from "./utils.js";

export const testUpdatePurpose = (): ReturnType<typeof describe> =>
  describe("updatePurpose and updateReversePurpose", () => {
    const tenantType = randomArrayItem(Object.values(tenantKind));
    const tenant: Tenant = {
      ...getMockTenant(),
      kind: tenantType,
    };

    const eServiceDeliver: EService = {
      ...getMockEService(),
      mode: eserviceMode.deliver,
    };

    const eServiceReceive: EService = {
      ...getMockEService(),
      mode: eserviceMode.receive,
      producerId: tenant.id,
    };

    const purposeForReceive: Purpose = {
      ...getMockPurpose(),
      eserviceId: eServiceReceive.id,
      consumerId: tenant.id,
      versions: [
        { ...getMockPurposeVersion(), state: purposeVersionState.draft },
      ],
      riskAnalysisForm: {
        ...getMockValidRiskAnalysisForm(tenantType),
        id: generateId(),
      },
    };

    const purposeForDeliver: Purpose = {
      ...getMockPurpose(),
      eserviceId: eServiceDeliver.id,
      consumerId: tenant.id,
      versions: [
        { ...getMockPurposeVersion(), state: purposeVersionState.draft },
      ],
    };

    const validRiskAnalysis = getMockValidRiskAnalysis(tenantType);

    const purposeUpdateContent: ApiPurposeUpdateContent = {
      title: "test",
      dailyCalls: 10,
      description: "test",
      isFreeOfCharge: true,
      freeOfChargeReason: "reason",
      riskAnalysisForm: buildRiskAnalysisSeed(validRiskAnalysis),
    };

    const reversePurposeUpdateContent: ApiReversePurposeUpdateContent = {
      ...purposeUpdateContent,
    };

    it("Should write on event store for the update of a purpose of an e-service in mode DELIVER", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      await addOnePurpose(purposeForDeliver, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
      await writeInReadmodel(tenant, tenants);

      await purposeService.updatePurpose({
        purposeId: purposeForDeliver.id,
        purposeUpdateContent,
        organizationId: tenant.id,
        correlationId: generateId(),
      });

      const writtenEvent = await readLastEventByStreamId(
        purposeForDeliver.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: purposeForDeliver.id,
        version: "1",
        type: "DraftPurposeUpdated",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: DraftPurposeUpdatedV2,
        payload: writtenEvent.data,
      });

      const expectedPurpose: Purpose = createUpdatedPurpose(
        purposeForDeliver,
        purposeUpdateContent,
        validRiskAnalysis,
        writtenPayload.purpose!.riskAnalysisForm!
      );

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    });
    it("Should write on event store for the update of a purpose of an e-service in mode RECEIVE", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      await addOnePurpose(purposeForReceive, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(eServiceReceive), eservices);
      await writeInReadmodel(tenant, tenants);

      await purposeService.updateReversePurpose({
        purposeId: purposeForReceive.id,
        reversePurposeUpdateContent,
        organizationId: tenant.id,
        correlationId: generateId(),
      });

      const writtenEvent = await readLastEventByStreamId(
        purposeForReceive.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: purposeForReceive.id,
        version: "1",
        type: "DraftPurposeUpdated",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: DraftPurposeUpdatedV2,
        payload: writtenEvent.data,
      });

      const expectedPurpose: Purpose = createUpdatedPurpose(
        purposeForReceive,
        reversePurposeUpdateContent,
        validRiskAnalysis,
        writtenPayload.purpose!.riskAnalysisForm!
      );

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));
    });
    it("Should throw purposeNotFound if the purpose doesn't exist", async () => {
      await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
      await writeInReadmodel(tenant, tenants);

      const purposeId: PurposeId = unsafeBrandId(generateId());

      expect(
        purposeService.updatePurpose({
          purposeId,
          purposeUpdateContent,
          organizationId: tenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(purposeNotFound(purposeId));
    });
    it("Should throw organizationIsNotTheConsumer if the organization is not the consumer", async () => {
      const mockPurpose: Purpose = {
        ...purposeForDeliver,
        consumerId: generateId(),
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
      await writeInReadmodel(tenant, tenants);

      const organizationId: TenantId = unsafeBrandId(generateId());

      expect(
        purposeService.updatePurpose({
          purposeId: mockPurpose.id,
          purposeUpdateContent,
          organizationId,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(organizationIsNotTheConsumer(organizationId));
    });
    it.each(
      Object.values(purposeVersionState).filter(
        (state) => state !== purposeVersionState.draft
      )
    )(
      "Should throw purposeNotInDraftState if the purpose is in state %s",
      async (state) => {
        const mockPurpose: Purpose = {
          ...purposeForDeliver,
          versions: [{ ...getMockPurposeVersion(state) }],
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
        await writeInReadmodel(tenant, tenants);

        expect(
          purposeService.updatePurpose({
            purposeId: mockPurpose.id,
            purposeUpdateContent,
            organizationId: tenant.id,
            correlationId: generateId(),
          })
        ).rejects.toThrowError(purposeNotInDraftState(mockPurpose.id));
      }
    );
    it("Should throw eserviceNotFound if the eservice doesn't exist", async () => {
      const eserviceId: EServiceId = unsafeBrandId(generateId());
      const mockPurpose: Purpose = {
        ...purposeForDeliver,
        eserviceId,
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(tenant, tenants);

      expect(
        purposeService.updatePurpose({
          purposeId: mockPurpose.id,
          purposeUpdateContent,
          organizationId: tenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(eserviceNotFound(eserviceId));
    });
    it("should throw eServiceModeNotAllowed if the eService mode is incorrect when expecting DELIVER", async () => {
      await addOnePurpose(purposeForReceive, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(eServiceReceive), eservices);
      await writeInReadmodel(tenant, tenants);

      expect(
        purposeService.updatePurpose({
          purposeId: purposeForReceive.id,
          purposeUpdateContent,
          organizationId: tenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(
        eServiceModeNotAllowed(eServiceReceive.id, "Deliver")
      );
    });
    it("should throw eServiceModeNotAllowed if the eService mode is incorrect when expecting RECEIVE", async () => {
      await addOnePurpose(purposeForDeliver, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
      await writeInReadmodel(tenant, tenants);

      expect(
        purposeService.updateReversePurpose({
          purposeId: purposeForDeliver.id,
          reversePurposeUpdateContent,
          organizationId: tenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(
        eServiceModeNotAllowed(eServiceDeliver.id, "Receive")
      );
    });
    it("Should throw missingFreeOfChargeReason if the freeOfChargeReason is missing", async () => {
      await addOnePurpose(purposeForDeliver, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
      await writeInReadmodel(tenant, tenants);

      expect(
        purposeService.updatePurpose({
          purposeId: purposeForDeliver.id,
          purposeUpdateContent: {
            ...purposeUpdateContent,
            freeOfChargeReason: undefined,
          },
          organizationId: tenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(missingFreeOfChargeReason());
    });
    it("Should throw tenantNotFound if the tenant does not exist", async () => {
      await addOnePurpose(purposeForDeliver, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);

      expect(
        purposeService.updatePurpose({
          purposeId: purposeForDeliver.id,
          purposeUpdateContent,
          organizationId: tenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(tenantNotFound(tenant.id));

      await addOnePurpose(purposeForReceive, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(eServiceReceive), eservices);

      expect(
        purposeService.updateReversePurpose({
          purposeId: purposeForReceive.id,
          reversePurposeUpdateContent,
          organizationId: tenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(tenantNotFound(tenant.id));
    });
    it("Should throw tenantKindNotFound if the tenant kind does not exist", async () => {
      const mockTenant = {
        ...tenant,
        kind: undefined,
      };

      await addOnePurpose(purposeForDeliver, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
      await writeInReadmodel(mockTenant, tenants);

      expect(
        purposeService.updatePurpose({
          purposeId: purposeForDeliver.id,
          purposeUpdateContent,
          organizationId: mockTenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
    });
    it("Should throw riskAnalysisValidationFailed if the risk analysis is not valid in updatePurpose", async () => {
      await addOnePurpose(purposeForDeliver, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(eServiceDeliver), eservices);
      await writeInReadmodel(tenant, tenants);

      const invalidRiskAnalysis: RiskAnalysis = {
        ...validRiskAnalysis,
        riskAnalysisForm: {
          ...validRiskAnalysis.riskAnalysisForm,
          version: "0",
        },
      };

      const mockPurposeUpdateContent: ApiPurposeUpdateContent = {
        ...purposeUpdateContent,
        riskAnalysisForm: buildRiskAnalysisSeed(invalidRiskAnalysis),
      };

      expect(
        purposeService.updatePurpose({
          purposeId: purposeForDeliver.id,
          purposeUpdateContent: mockPurposeUpdateContent,
          organizationId: tenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(
        riskAnalysisValidationFailed([unexpectedRulesVersionError("0")])
      );
    });
    it("Should throw riskAnalysisValidationFailed if the risk analysis is not valid in updateReversePurpose", async () => {
      const purposeWithInvalidRiskAnalysis: Purpose = {
        ...purposeForReceive,
        riskAnalysisForm: {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ...purposeForReceive.riskAnalysisForm!,
          version: "0",
        },
      };

      await addOnePurpose(purposeWithInvalidRiskAnalysis, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(eServiceReceive), eservices);
      await writeInReadmodel(tenant, tenants);

      expect(
        purposeService.updateReversePurpose({
          purposeId: purposeWithInvalidRiskAnalysis.id,
          reversePurposeUpdateContent,
          organizationId: tenant.id,
          correlationId: generateId(),
        })
      ).rejects.toThrowError(
        riskAnalysisValidationFailed([unexpectedRulesVersionError("0")])
      );
    });
  });
