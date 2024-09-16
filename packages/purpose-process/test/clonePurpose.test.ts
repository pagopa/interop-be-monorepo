/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockEService,
  getMockPurpose,
  getMockPurposeVersion,
  getMockTenant,
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
  toReadModelTenant,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  formatDateddMMyyyyHHmmss,
  genericLogger,
} from "pagopa-interop-commons";
import {
  duplicatedPurposeTitle,
  purposeCannotBeCloned,
  purposeNotFound,
  tenantKindNotFound,
} from "../src/model/domain/errors.js";
import {
  addOnePurpose,
  agreements,
  purposeService,
  readLastPurposeEvent,
  tenants,
} from "./utils.js";

describe("clonePurpose", async () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it("should write on event-store for the cloning of a purpose", async () => {
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

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    const { purpose, isRiskAnalysisValid } = await purposeService.clonePurpose({
      purposeId: mockPurpose.id,
      organizationId: mockTenant.id,
      seed: {
        eserviceId: mockEService.id,
      },
      correlationId: generateId(),
      logger: genericLogger,
    });

    const writtenEvent = await readLastPurposeEvent(purpose.id);

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
      title: `${mockPurpose.title} - clone - ${formatDateddMMyyyyHHmmss(
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
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(false);
  });
  it("should write on event-store for the cloning of a purpose, making sure the title is cut to 60 characters", async () => {
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
      title: "Title exceeding the maximum length when the suffix is added",
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
      versions: [getMockPurposeVersion(purposeVersionState.active)],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);
    await writeInReadmodel(toReadModelAgreement(mockAgreement), agreements);

    const { purpose, isRiskAnalysisValid } = await purposeService.clonePurpose({
      purposeId: mockPurpose.id,
      organizationId: mockTenant.id,
      seed: {
        eserviceId: mockEService.id,
      },
      correlationId: generateId(),
      logger: genericLogger,
    });

    const writtenEvent = await readLastPurposeEvent(purpose.id);

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
      title: `Title exceeding the maximum... - clone - ${formatDateddMMyyyyHHmmss(
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
    expect(expectedPurpose.title.length).toBe(60);
    expect(writtenPayload.purpose).toEqual(toPurposeV2(purpose));
    expect(isRiskAnalysisValid).toBe(false);
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

    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);
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

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);
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

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);
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
      title: `${mockPurposeToClone.title} - clone - ${formatDateddMMyyyyHHmmss(
        new Date()
      )}`,
      eserviceId: mockEService.id,
      consumerId: mockTenant.id,
    };

    await addOnePurpose(mockPurposeToClone);
    await addOnePurpose(mockPurposeWithSameName);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);
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

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelTenant(mockTenant), tenants);
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
