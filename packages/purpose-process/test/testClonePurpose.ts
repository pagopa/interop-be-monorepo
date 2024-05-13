/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
  readLastEventByStreamId,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  Purpose,
  PurposeClonedV2,
  agreementState,
  generateId,
  purposeVersionState,
  tenantKind,
  toPurposeV2,
  toReadModelAgreement,
  unsafeBrandId,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { formatDateAndTime, genericLogger } from "pagopa-interop-commons";
import {
  duplicatedPurposeTitle,
  purposeCannotBeCloned,
  purposeNotFound,
  tenantKindNotFound,
} from "../src/model/domain/errors.js";
import { addOnePurpose } from "./utils.js";
import {
  agreements,
  postgresDB,
  purposeService,
  purposes,
  tenants,
} from "./purposeService.integration.test.js";

export const testClonePurpose = (): ReturnType<typeof describe> =>
  describe("clonePurpose", async () => {
    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
    });
    afterAll(() => {
      vi.useRealTimers();
    });
    it("should write on event-store for the cloning of a purpose", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const mockTenant = {
        ...getMockTenant(),
        kind: tenantKind.PA,
      };
      const mockEService = getMockEService();

      const mockAgreement = getMockAgreement(
        mockEService.id,
        mockTenant.id,
        agreementState.active
      );

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        consumerId: mockTenant.id,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(mockTenant, tenants);
      await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

      const { purpose } = await purposeService.clonePurpose({
        purposeId: mockPurpose.id,
        organizationId: mockTenant.id,
        seed: {
          eserviceId: mockEService.id,
        },
        correlationId: generateId(),
        logger: genericLogger,
      });

      const writtenEvent = await readLastEventByStreamId(
        purpose.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: purpose.id,
        version: "0",
        type: "PurposeCloned",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeClonedV2,
        payload: writtenEvent.data,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        id: unsafeBrandId(writtenPayload.purpose!.id),
        title: `${mockPurpose.title} - clone - ${formatDateAndTime(
          new Date()
        )}`,
        versions: [
          {
            id: unsafeBrandId(writtenPayload.purpose!.versions[0].id),
            state: purposeVersionState.draft,
            createdAt: new Date(),
            dailyCalls: mockPurpose.versions[0].dailyCalls,
          },
        ],
        createdAt: new Date(),
      };

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

      vi.useRealTimers();
    });
    it("should throw purposeNotFound if the purpose to clone doesn't exist", async () => {
      const mockTenant = {
        ...getMockTenant(),
        kind: tenantKind.PA,
      };
      const mockEService = getMockEService();

      const mockAgreement = getMockAgreement(
        mockEService.id,
        mockTenant.id,
        agreementState.active
      );

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        consumerId: mockTenant.id,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };

      await writeInReadmodel(mockTenant, tenants);
      await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

      expect(
        purposeService.clonePurpose({
          purposeId: mockPurpose.id,
          organizationId: mockTenant.id,
          seed: {
            eserviceId: mockEService.id,
          },
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(purposeNotFound(mockPurpose.id));
    });
    it("should throw purposeCannotBeCloned if the purpose is in draft (no versions)", async () => {
      const mockTenant = {
        ...getMockTenant(),
        kind: tenantKind.PA,
      };
      const mockEService = getMockEService();

      const mockAgreement = getMockAgreement(
        mockEService.id,
        mockTenant.id,
        agreementState.active
      );

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        consumerId: mockTenant.id,
        versions: [],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(mockTenant, tenants);
      await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

      expect(
        purposeService.clonePurpose({
          purposeId: mockPurpose.id,
          organizationId: mockTenant.id,
          seed: {
            eserviceId: mockEService.id,
          },
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(purposeCannotBeCloned(mockPurpose.id));
    });
    it("should throw purposeCannotBeCloned if the purpose is in draft (draft version)", async () => {
      const mockTenant = {
        ...getMockTenant(),
        kind: tenantKind.PA,
      };
      const mockEService = getMockEService();

      const mockAgreement = getMockAgreement(
        mockEService.id,
        mockTenant.id,
        agreementState.active
      );

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        consumerId: mockTenant.id,
        versions: [getMockPurposeVersion(purposeVersionState.draft)],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(mockTenant, tenants);
      await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

      expect(
        purposeService.clonePurpose({
          purposeId: mockPurpose.id,
          organizationId: mockTenant.id,
          seed: {
            eserviceId: mockEService.id,
          },
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(purposeCannotBeCloned(mockPurpose.id));
    });
    it("should throw duplicatedPurposeTitle if a purpose with the same name already exists", async () => {
      const mockTenant = {
        ...getMockTenant(),
        kind: tenantKind.PA,
      };
      const mockEService = getMockEService();

      const mockAgreement = getMockAgreement(
        mockEService.id,
        mockTenant.id,
        agreementState.active
      );

      const mockPurposeToClone: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        consumerId: mockTenant.id,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };

      const mockPurposeWithSameName: Purpose = {
        ...getMockPurpose(),
        title: `${mockPurposeToClone.title} - clone - ${formatDateAndTime(
          new Date()
        )}`,
        eserviceId: mockEService.id,
        consumerId: mockTenant.id,
      };

      await addOnePurpose(mockPurposeToClone, postgresDB, purposes);
      await addOnePurpose(mockPurposeWithSameName, postgresDB, purposes);
      await writeInReadmodel(mockTenant, tenants);
      await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

      expect(
        purposeService.clonePurpose({
          purposeId: mockPurposeToClone.id,
          organizationId: mockTenant.id,
          seed: {
            eserviceId: mockEService.id,
          },
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        duplicatedPurposeTitle(mockPurposeWithSameName.title)
      );
    });
    it("should throw tenantKindNotFound if the tenant kind doesn't exist", async () => {
      const mockTenant = {
        ...getMockTenant(),
        kind: undefined,
      };
      const mockEService = getMockEService();

      const mockAgreement = getMockAgreement(
        mockEService.id,
        mockTenant.id,
        agreementState.active
      );

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        consumerId: mockTenant.id,
        versions: [getMockPurposeVersion(purposeVersionState.active)],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(mockTenant, tenants);
      await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

      expect(
        purposeService.clonePurpose({
          purposeId: mockPurpose.id,
          organizationId: mockTenant.id,
          seed: {
            eserviceId: mockEService.id,
          },
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
    });
  });
