/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockTenant,
  getMockPurpose,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  tenantKind,
  Purpose,
  generateId,
  toReadModelEService,
  PurposeId,
  EServiceId,
  TenantId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  purposeNotFound,
  eserviceNotFound,
  tenantNotFound,
  tenantKindNotFound,
} from "../src/model/domain/errors.js";
import { getMockEService, addOnePurpose } from "./utils.js";
import {
  eservices,
  postgresDB,
  purposeService,
  purposes,
  tenants,
} from "./purposeService.integration.test.js";

export const testGetPurposeById = (): ReturnType<typeof describe> =>
  describe("getPurposeById", () => {
    it("should get the purpose if it exists", async () => {
      const mockTenant = {
        ...getMockTenant(),
        kind: tenantKind.PA,
      };

      const mockEService = getMockEService();
      const mockPurpose1: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
      };
      const mockPurpose2: Purpose = {
        ...getMockPurpose(),
        id: generateId(),
        title: "another purpose",
      };
      await addOnePurpose(mockPurpose1, postgresDB, purposes);
      await addOnePurpose(mockPurpose2, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockTenant, tenants);

      const result = await purposeService.getPurposeById(
        mockPurpose1.id,
        mockTenant.id
      );
      expect(result).toMatchObject({
        purpose: mockPurpose1,
        isRiskAnalysisValid: false,
      });
    });
    it("should throw purposeNotFound if the purpose doesn't exist", async () => {
      const notExistingId: PurposeId = generateId();
      const mockTenant = getMockTenant();
      const mockPurpose = getMockPurpose();
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(mockTenant, tenants);

      expect(
        purposeService.getPurposeById(notExistingId, mockTenant.id)
      ).rejects.toThrowError(purposeNotFound(notExistingId));
    });
    it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
      const notExistingId: EServiceId = generateId();
      const mockTenant = {
        ...getMockTenant(),
        kind: tenantKind.PA,
      };

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: notExistingId,
      };
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(mockTenant, tenants);

      expect(
        purposeService.getPurposeById(mockPurpose.id, mockTenant.id)
      ).rejects.toThrowError(eserviceNotFound(notExistingId));
    });
    it("should throw tenantNotFound if the tenant doesn't exist", async () => {
      const notExistingId: TenantId = generateId();
      const mockEService = getMockEService();

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
      };
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.getPurposeById(mockPurpose.id, notExistingId)
      ).rejects.toThrowError(tenantNotFound(notExistingId));
    });
    it("should throw tenantKindNotFound if the tenant doesn't exist", async () => {
      const mockTenant = getMockTenant();
      const mockEService = getMockEService();

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
      };
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);
      await writeInReadmodel(mockTenant, tenants);

      expect(
        purposeService.getPurposeById(mockPurpose.id, mockTenant.id)
      ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
    });
  });
