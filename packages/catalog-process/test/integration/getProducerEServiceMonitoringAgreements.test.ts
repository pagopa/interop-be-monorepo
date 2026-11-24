import {
  getMockAgreement,
  getMockAuthData,
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  AgreementState,
  agreementState,
  Descriptor,
  delegationKind,
  delegationState,
  DescriptorState,
  descriptorState,
  EService,
  generateId,
  operationForbidden,
  TenantId,
  TenantKind,
  tenantKind,
  UserId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { eServiceNotFound } from "../../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOneTenant,
  catalogService,
} from "../integrationUtils.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("getProducerEServiceMonitoringAgreements", () => {
  const producerId: TenantId = generateId();
  const context = getMockContext({ authData: getMockAuthData(producerId) });
  const latestPublishedAt = new Date("2026-01-01T00:00:00Z");

  // Descriptor i has version i + 1, the last one is the latest.
  const addEService = async (
    states: DescriptorState[],
    eserviceProducerId: TenantId = producerId
  ): Promise<EService> => {
    const eservice: EService = {
      ...getMockEService(),
      producerId: eserviceProducerId,
      descriptors: states.map(
        (state, index): Descriptor => ({
          ...getMockDescriptor(),
          version: String(index + 1),
          state,
          publishedAt: latestPublishedAt,
        })
      ),
    };
    await addOneEService(eservice);
    return eservice;
  };

  const addAgreement = async ({
    eservice,
    descriptor,
    state = agreementState.active,
    consumerId = generateId<TenantId>(),
    upgradeDays,
  }: {
    eservice: EService;
    descriptor: Descriptor;
    state?: AgreementState;
    consumerId?: TenantId;
    upgradeDays?: number;
  }): Promise<TenantId> => {
    await addOneAgreement({
      ...getMockAgreement(eservice.id, consumerId, state),
      producerId: eservice.producerId,
      descriptorId: descriptor.id,
      stamps:
        upgradeDays !== undefined
          ? {
              upgrade: {
                who: generateId<UserId>(),
                when: new Date(
                  latestPublishedAt.getTime() + upgradeDays * DAY_MS
                ),
              },
            }
          : {},
    });
    return consumerId;
  };

  const addTenant = async (kind: TenantKind | undefined): Promise<TenantId> => {
    const tenant = { ...getMockTenant(), kind };
    await addOneTenant(tenant);
    return tenant.id;
  };

  const versionsOf = (
    eservice: EService,
    counts: number[]
  ): Array<{ descriptorId: string; version: string; consumersCount: number }> =>
    counts.map((consumersCount, i) => {
      const descriptor =
        eservice.descriptors[eservice.descriptors.length - 1 - i];
      return {
        descriptorId: descriptor.id,
        version: descriptor.version,
        consumersCount,
      };
    });

  it("should return zero counters for an e-service without versions and agreements", async () => {
    const eservice = await addEService([descriptorState.draft]);

    expect(
      await catalogService.getProducerEServiceMonitoringAgreements(
        eservice.id,
        context
      )
    ).toEqual({
      consumersByVersion: { total: 0, versions: [] },
      consumersByKind: { total: 0, pa: 0, gspScp: 0, private: 0 },
      pendingAgreements: 0,
    });
  });

  it("should list every version with 3 versions or fewer, including versions without consumers", async () => {
    const eservice = await addEService([
      descriptorState.deprecated,
      descriptorState.suspended,
      descriptorState.published,
    ]);
    const [v1, , v3] = eservice.descriptors;
    await addAgreement({ eservice, descriptor: v1 });
    await addAgreement({ eservice, descriptor: v3 });
    await addAgreement({ eservice, descriptor: v3 });

    const result = await catalogService.getProducerEServiceMonitoringAgreements(
      eservice.id,
      context
    );

    expect(result.consumersByVersion).toEqual({
      total: 3,
      versions: versionsOf(eservice, [2, 0, 1]),
    });
  });

  it("should list the latest two versions and sum the others with more than 3 versions", async () => {
    // Version 10 is the latest: versions are ordered numerically.
    const eservice = await addEService([
      ...Array.from({ length: 9 }, () => descriptorState.deprecated),
      descriptorState.archiving,
    ]);
    const descriptors = eservice.descriptors;
    await addAgreement({ eservice, descriptor: descriptors[9] });
    await addAgreement({ eservice, descriptor: descriptors[8] });
    await addAgreement({ eservice, descriptor: descriptors[8] });
    await addAgreement({ eservice, descriptor: descriptors[0] });
    await addAgreement({ eservice, descriptor: descriptors[1] });
    await addAgreement({ eservice, descriptor: descriptors[2] });

    const result = await catalogService.getProducerEServiceMonitoringAgreements(
      eservice.id,
      context
    );

    expect(result.consumersByVersion).toEqual({
      total: 6,
      versions: versionsOf(eservice, [1, 2]),
      olderVersionsConsumersCount: 3,
    });
  });

  it("should not report older versions with exactly 4 versions where the older ones have no consumers", async () => {
    const eservice = await addEService([
      descriptorState.deprecated,
      descriptorState.deprecated,
      descriptorState.suspended,
      descriptorState.archivingSuspended,
    ]);

    const result = await catalogService.getProducerEServiceMonitoringAgreements(
      eservice.id,
      context
    );

    expect(result.consumersByVersion).toEqual({
      total: 0,
      versions: versionsOf(eservice, [0, 0]),
      olderVersionsConsumersCount: 0,
    });
  });

  it("should exclude Draft, WaitingForApproval and Archived descriptors from the versions", async () => {
    const eservice = await addEService([
      descriptorState.archived,
      descriptorState.published,
      descriptorState.waitingForApproval,
      descriptorState.draft,
    ]);

    const result = await catalogService.getProducerEServiceMonitoringAgreements(
      eservice.id,
      context
    );

    expect(result.consumersByVersion.versions).toEqual([
      {
        descriptorId: eservice.descriptors[1].id,
        version: "2",
        consumersCount: 0,
      },
    ]);
  });

  it("should count only Active agreements for D5 and D6 and only Pending agreements for D7", async () => {
    const eservice = await addEService([descriptorState.published]);
    const [descriptor] = eservice.descriptors;
    const paConsumer = await addTenant(tenantKind.PA);
    await addAgreement({ eservice, descriptor, consumerId: paConsumer });
    for (const state of [
      agreementState.suspended,
      agreementState.archived,
      agreementState.draft,
      agreementState.rejected,
      agreementState.missingCertifiedAttributes,
    ]) {
      await addAgreement({
        eservice,
        descriptor,
        state,
        consumerId: await addTenant(tenantKind.PRIVATE),
      });
    }
    await addAgreement({ eservice, descriptor, state: agreementState.pending });
    await addAgreement({ eservice, descriptor, state: agreementState.pending });

    // Agreements on another e-service of the same producer are ignored.
    const otherEService = await addEService([descriptorState.published]);
    await addAgreement({
      eservice: otherEService,
      descriptor: otherEService.descriptors[0],
    });
    await addAgreement({
      eservice: otherEService,
      descriptor: otherEService.descriptors[0],
      state: agreementState.pending,
    });

    expect(
      await catalogService.getProducerEServiceMonitoringAgreements(
        eservice.id,
        context
      )
    ).toEqual({
      consumersByVersion: {
        total: 1,
        versions: versionsOf(eservice, [1]),
      },
      consumersByKind: { total: 1, pa: 1, gspScp: 0, private: 0 },
      pendingAgreements: 2,
    });
  });

  it("should count distinct consumers and group them by tenant kind", async () => {
    const eservice = await addEService([
      descriptorState.deprecated,
      descriptorState.published,
    ]);
    const [v1, v2] = eservice.descriptors;
    // The same consumer active on two versions counts once in the total.
    const paConsumer = await addTenant(tenantKind.PA);
    await addAgreement({ eservice, descriptor: v1, consumerId: paConsumer });
    await addAgreement({ eservice, descriptor: v2, consumerId: paConsumer });
    await addAgreement({
      eservice,
      descriptor: v2,
      consumerId: await addTenant(tenantKind.PA),
    });
    await addAgreement({
      eservice,
      descriptor: v2,
      consumerId: await addTenant(tenantKind.GSP),
    });
    await addAgreement({
      eservice,
      descriptor: v2,
      consumerId: await addTenant(tenantKind.SCP),
    });
    await addAgreement({
      eservice,
      descriptor: v1,
      consumerId: await addTenant(tenantKind.PRIVATE),
    });
    // A consumer without kind counts in the total only.
    await addAgreement({
      eservice,
      descriptor: v1,
      consumerId: await addTenant(undefined),
    });

    const result = await catalogService.getProducerEServiceMonitoringAgreements(
      eservice.id,
      context
    );

    expect(result.consumersByVersion).toEqual({
      total: 6,
      versions: versionsOf(eservice, [4, 3]),
    });
    expect(result.consumersByKind).toEqual({
      total: 6,
      pa: 2,
      gspScp: 2,
      private: 1,
    });
  });

  it("should compute the median upgrade days with an odd number of upgrades", async () => {
    const eservice = await addEService([
      descriptorState.deprecated,
      descriptorState.published,
    ]);
    const [v1, v2] = eservice.descriptors;
    await addAgreement({ eservice, descriptor: v2, upgradeDays: 2 });
    await addAgreement({ eservice, descriptor: v2, upgradeDays: 10 });
    await addAgreement({ eservice, descriptor: v2, upgradeDays: 30 });
    // Not counted: direct subscription, not Active, not on the latest version.
    await addAgreement({ eservice, descriptor: v2 });
    await addAgreement({
      eservice,
      descriptor: v2,
      state: agreementState.suspended,
      upgradeDays: 100,
    });
    await addAgreement({ eservice, descriptor: v1, upgradeDays: 100 });

    const result = await catalogService.getProducerEServiceMonitoringAgreements(
      eservice.id,
      context
    );

    expect(result.consumersByVersion.medianUpgradeDays).toBe(10);
  });

  it("should compute the median upgrade days with an even number of upgrades, rounded", async () => {
    const eservice = await addEService([
      descriptorState.deprecated,
      descriptorState.published,
    ]);
    const latest = eservice.descriptors[1];
    await addAgreement({ eservice, descriptor: latest, upgradeDays: 4 });
    await addAgreement({ eservice, descriptor: latest, upgradeDays: 10 });
    await addAgreement({ eservice, descriptor: latest, upgradeDays: 11 });
    await addAgreement({ eservice, descriptor: latest, upgradeDays: 20 });

    const result = await catalogService.getProducerEServiceMonitoringAgreements(
      eservice.id,
      context
    );

    // Median of 10 and 11 is 10.5, rounded half away from zero.
    expect(result.consumersByVersion.medianUpgradeDays).toBe(11);
  });

  it("should omit the median when no agreement reached the latest version through an upgrade", async () => {
    const eservice = await addEService([
      descriptorState.deprecated,
      descriptorState.published,
    ]);
    await addAgreement({ eservice, descriptor: eservice.descriptors[1] });

    const result = await catalogService.getProducerEServiceMonitoringAgreements(
      eservice.id,
      context
    );

    expect(result.consumersByVersion.medianUpgradeDays).toBeUndefined();
  });

  it("should throw eServiceNotFound if the e-service does not exist", async () => {
    const eserviceId = generateId<EService["id"]>();

    await expect(
      catalogService.getProducerEServiceMonitoringAgreements(
        eserviceId,
        context
      )
    ).rejects.toThrowError(eServiceNotFound(eserviceId));
  });

  it("should throw operationForbidden if the requester is neither the producer nor the delegate", async () => {
    const eservice = await addEService(
      [descriptorState.published],
      generateId<TenantId>()
    );

    await expect(
      catalogService.getProducerEServiceMonitoringAgreements(
        eservice.id,
        context
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw operationForbidden for the producer when an active delegation exists", async () => {
    const eservice = await addEService([descriptorState.published]);
    await addOneDelegation(
      getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        delegatorId: producerId,
        state: delegationState.active,
      })
    );

    await expect(
      catalogService.getProducerEServiceMonitoringAgreements(
        eservice.id,
        context
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should allow the delegate producer", async () => {
    const delegatorId = generateId<TenantId>();
    const eservice = await addEService(
      [descriptorState.published],
      delegatorId
    );
    await addOneDelegation(
      getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        delegatorId,
        delegateId: producerId,
        state: delegationState.active,
      })
    );
    await addAgreement({
      eservice,
      descriptor: eservice.descriptors[0],
      state: agreementState.pending,
    });

    const result = await catalogService.getProducerEServiceMonitoringAgreements(
      eservice.id,
      context
    );

    expect(result.pendingAgreements).toBe(1);
  });
});
