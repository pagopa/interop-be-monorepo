/* eslint-disable functional/no-let */
/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable @typescript-eslint/no-floating-promises */

import {
  getMockPurposeVersion,
  getMockPurpose,
  getMockTenant,
  getMockDescriptorPublished,
  getMockEService,
  getMockAgreement,
  getMockValidRiskAnalysisForm,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  PurposeVersion,
  purposeVersionState,
  Purpose,
  generateId,
  Tenant,
  EService,
  Agreement,
  Descriptor,
  agreementState,
  toReadModelEService,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  tenantKindNotFound,
  missingRiskAnalysis,
} from "../src/model/domain/errors.js";
import {
  agreements,
  eservices,
  postgresDB,
  purposeService,
  purposes,
  tenants,
} from "./purposeService.integration.test.js";
import { addOnePurpose } from "./utils.js";

export const testActivatePurposeVersion = (): ReturnType<typeof describe> =>
  describe("activatePurposeVersion", () => {
    let mockConsumer: Tenant;
    let mockProducer: Tenant;
    let mockEService: EService;
    let mockAgreement: Agreement;
    let mockPurpose: Purpose;
    let mockPurposeVersion: PurposeVersion;
    let mockEServiceDescriptor: Descriptor;

    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      mockConsumer = {
        ...getMockTenant(),
        kind: "PA",
      };

      mockProducer = {
        ...getMockTenant(),
        kind: "PA",
      };

      mockEServiceDescriptor = getMockDescriptorPublished();

      mockEService = {
        ...getMockEService(),
        producerId: mockProducer.id,
        descriptors: [mockEServiceDescriptor],
      };

      mockAgreement = {
        ...getMockAgreement(),
        eserviceId: mockEService.id,
        consumerId: mockConsumer.id,
        descriptorId: mockEService.descriptors[0].id,
        state: agreementState.active,
      };

      mockPurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.active,
      };

      mockPurpose = {
        ...getMockPurpose(),
        riskAnalysisForm: getMockValidRiskAnalysisForm("PA"),
        consumerId: mockAgreement.consumerId,
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("should throw error if the purpose consumer has no kind", async () => {
      const consumer = { ...mockConsumer, kind: undefined };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(consumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: consumer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(tenantKindNotFound(consumer.id));
    });

    it("should throw if the purpose has no risk analysis", async () => {
      const purpose: Purpose = { ...mockPurpose, riskAnalysisForm: undefined };

      await addOnePurpose(purpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockAgreement, agreements);
      await writeInReadmodel(mockConsumer, tenants);
      await writeInReadmodel(mockProducer, tenants);

      expect(async () => {
        await purposeService.activatePurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: mockConsumer.id,
          correlationId: generateId(),
        });
      }).rejects.toThrowError(missingRiskAnalysis(mockPurpose.id));
    });
  });
