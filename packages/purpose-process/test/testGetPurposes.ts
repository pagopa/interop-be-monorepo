import {
  EService,
  Purpose,
  PurposeVersion,
  TenantId,
  generateId,
  purposeVersionState,
  toReadModelEService,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getMockPurposeVersion,
  getMockPurpose,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import { addOnePurpose, getMockEService } from "./utils.js";
import {
  postgresDB,
  purposes,
  eservices,
  purposeService,
} from "./purposeService.integration.test.js";

export const testGetPurposes = (): ReturnType<typeof describe> =>
  describe("getPurposes", async () => {
    const producerId1: TenantId = generateId();
    const producerId2: TenantId = generateId();
    const consumerId1: TenantId = generateId();

    const mockEService1ByTenant1: EService = {
      ...getMockEService(),
      producerId: producerId1,
    };

    const mockEService2ByTenant1: EService = {
      ...getMockEService(),
      producerId: producerId1,
    };

    const mockEService3ByTenant2: EService = {
      ...getMockEService(),
      producerId: producerId2,
    };

    const mockPurposeVersion1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.draft,
    };
    const mockPurpose1: Purpose = {
      ...getMockPurpose(),
      title: "purpose 1 - test",
      consumerId: consumerId1,
      eserviceId: mockEService1ByTenant1.id,
      versions: [mockPurposeVersion1],
    };

    const mockPurposeVersion2: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.draft,
    };
    const mockPurpose2: Purpose = {
      ...getMockPurpose(),
      title: "purpose 2",
      eserviceId: mockEService1ByTenant1.id,
      versions: [mockPurposeVersion2],
    };

    const mockPurposeVersion3: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.active,
    };
    const mockPurpose3: Purpose = {
      ...getMockPurpose(),
      title: "purpose 3",
      eserviceId: mockEService2ByTenant1.id,
      versions: [mockPurposeVersion3],
    };

    const mockPurposeVersion4: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.rejected,
    };
    const mockPurpose4: Purpose = {
      ...getMockPurpose(),
      title: "purpose 4",
      eserviceId: mockEService3ByTenant2.id,
      versions: [mockPurposeVersion4],
    };

    const mockPurposeVersion5: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.rejected,
    };
    const mockPurpose5: Purpose = {
      ...getMockPurpose(),
      title: "purpose 5",
      consumerId: consumerId1,
      versions: [mockPurposeVersion5],
    };

    const mockPurposeVersion6_1: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.archived,
    };
    const mockPurposeVersion6_2: PurposeVersion = {
      ...getMockPurposeVersion(),
      state: purposeVersionState.draft,
    };
    const mockPurpose6: Purpose = {
      ...getMockPurpose(),
      title: "purpose 6 - test",
      consumerId: consumerId1,
      eserviceId: mockEService3ByTenant2.id,
      versions: [mockPurposeVersion6_1, mockPurposeVersion6_2],
    };

    const mockPurpose7: Purpose = {
      ...getMockPurpose(),
      title: "purpose 7 - test",
      versions: [],
    };

    beforeEach(async () => {
      await addOnePurpose(mockPurpose1, postgresDB, purposes);
      await addOnePurpose(mockPurpose2, postgresDB, purposes);
      await addOnePurpose(mockPurpose3, postgresDB, purposes);
      await addOnePurpose(mockPurpose4, postgresDB, purposes);
      await addOnePurpose(mockPurpose5, postgresDB, purposes);
      await addOnePurpose(mockPurpose6, postgresDB, purposes);
      await addOnePurpose(mockPurpose7, postgresDB, purposes);

      await writeInReadmodel(
        toReadModelEService(mockEService1ByTenant1),
        eservices
      );
      await writeInReadmodel(
        toReadModelEService(mockEService2ByTenant1),
        eservices
      );
      await writeInReadmodel(
        toReadModelEService(mockEService3ByTenant2),
        eservices
      );
    });

    it("should get the purposes if they exist (parameters: name)", async () => {
      const result = await purposeService.getPurposes(
        {
          name: "test",
          eservicesIds: [],
          consumersIds: [],
          producersIds: [],
          states: [],
          excludeDraft: undefined,
        },
        { offset: 0, limit: 50 }
      );
      expect(result.totalCount).toBe(3);
      expect(result.results).toEqual([
        mockPurpose1,
        mockPurpose6,
        mockPurpose7,
      ]);
    });
    it("should get the purposes if they exist (parameters: eservicesIds)", async () => {
      const result = await purposeService.getPurposes(
        {
          eservicesIds: [mockEService1ByTenant1.id],
          consumersIds: [],
          producersIds: [],
          states: [],
          excludeDraft: undefined,
        },
        { offset: 0, limit: 50 }
      );
      expect(result.totalCount).toBe(2);
      expect(result.results).toEqual([mockPurpose1, mockPurpose2]);
    });
    it("should get the purposes if they exist (parameters: consumersIds)", async () => {
      const result = await purposeService.getPurposes(
        {
          eservicesIds: [],
          consumersIds: [consumerId1],
          producersIds: [],
          states: [],
          excludeDraft: undefined,
        },
        { offset: 0, limit: 50 }
      );
      expect(result.totalCount).toBe(3);
      expect(result.results).toEqual([
        mockPurpose1,
        mockPurpose5,
        mockPurpose6,
      ]);
    });
    it("should get the purposes if they exist (parameters: producersIds)", async () => {
      const result = await purposeService.getPurposes(
        {
          eservicesIds: [],
          consumersIds: [],
          producersIds: [producerId2],
          states: [],
          excludeDraft: undefined,
        },
        { offset: 0, limit: 50 }
      );
      expect(result.totalCount).toBe(2);
      expect(result.results).toEqual([mockPurpose4, mockPurpose6]);
    });
    it("should get the purposes if they exist (parameters: states)", async () => {
      const result = await purposeService.getPurposes(
        {
          eservicesIds: [],
          consumersIds: [],
          producersIds: [],
          states: [purposeVersionState.rejected, purposeVersionState.archived],
          excludeDraft: undefined,
        },
        { offset: 0, limit: 50 }
      );
      expect(result.totalCount).toBe(3);
      expect(result.results).toEqual([
        mockPurpose4,
        mockPurpose5,
        mockPurpose6,
      ]);
    });
    it("should not include draft versions and purposes without versions (excludeDraft = true)", async () => {
      const result = await purposeService.getPurposes(
        {
          eservicesIds: [],
          consumersIds: [],
          producersIds: [],
          states: [],
          excludeDraft: true,
        },
        { offset: 0, limit: 50 }
      );
      expect(result.totalCount).toBe(4);
      expect(result.results).toEqual([
        mockPurpose3,
        mockPurpose4,
        mockPurpose5,
        { ...mockPurpose6, versions: [mockPurposeVersion6_1] },
      ]);
    });
    it("should include draft versions and purposes without versions (excludeDraft = false)", async () => {
      const result = await purposeService.getPurposes(
        {
          eservicesIds: [],
          consumersIds: [],
          producersIds: [],
          states: [],
          excludeDraft: false,
        },
        { offset: 0, limit: 50 }
      );
      expect(result.totalCount).toBe(7);
      expect(result.results).toEqual([
        mockPurpose1,
        mockPurpose2,
        mockPurpose3,
        mockPurpose4,
        mockPurpose5,
        mockPurpose6,
        mockPurpose7,
      ]);
    });
    it("should get the purposes if they exist (pagination: offset)", async () => {
      const result = await purposeService.getPurposes(
        {
          eservicesIds: [],
          consumersIds: [],
          producersIds: [],
          states: [],
          excludeDraft: undefined,
        },
        { offset: 5, limit: 50 }
      );
      expect(result.results).toEqual([mockPurpose6, mockPurpose7]);
    });
    it("should get the purposes if they exist (pagination: limit)", async () => {
      const result = await purposeService.getPurposes(
        {
          eservicesIds: [],
          consumersIds: [],
          producersIds: [],
          states: [],
          excludeDraft: undefined,
        },
        { offset: 0, limit: 3 }
      );
      expect(result.results).toEqual([
        mockPurpose1,
        mockPurpose2,
        mockPurpose3,
      ]);
    });
    it("should not get the purposes if they don't exist", async () => {
      const result = await purposeService.getPurposes(
        {
          eservicesIds: [generateId()],
          consumersIds: [],
          producersIds: [generateId()],
          states: [],
          excludeDraft: undefined,
        },
        { offset: 0, limit: 50 }
      );
      expect(result.totalCount).toBe(0);
      expect(result.results).toEqual([]);
    });
    it("should get the purposes if they exist (parameters: name, eservicesIds, consumersIds, producersIds, states; exlcudeDraft = true)", async () => {
      const result = await purposeService.getPurposes(
        {
          name: "test",
          eservicesIds: [mockEService3ByTenant2.id],
          consumersIds: [consumerId1],
          producersIds: [producerId2],
          states: [purposeVersionState.archived],
          excludeDraft: true,
        },
        { offset: 0, limit: 50 }
      );
      expect(result.totalCount).toBe(1);
      expect(result.results).toEqual([
        { ...mockPurpose6, versions: [mockPurposeVersion6_1] },
      ]);
    });
    it("should get the purposes if they exist (parameters: name, eservicesIds, consumersIds, producersIds, states; exlcudeDraft = false)", async () => {
      const result = await purposeService.getPurposes(
        {
          name: "test",
          eservicesIds: [mockEService1ByTenant1.id],
          consumersIds: [consumerId1],
          producersIds: [producerId1],
          states: [purposeVersionState.draft],
          excludeDraft: false,
        },
        { offset: 0, limit: 50 }
      );
      expect(result.totalCount).toBe(1);
      expect(result.results).toEqual([mockPurpose1]);
    });
  });
