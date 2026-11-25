import {
  getMockAgreement,
  getMockAuthData,
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  AgreementState,
  agreementState,
  ArchivingScope,
  archivingScope,
  Descriptor,
  delegationKind,
  delegationState,
  DescriptorState,
  descriptorState,
  EService,
  generateId,
  operationForbidden,
  TenantId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { eServiceNotFound } from "../../src/model/domain/errors.js";
import { ArchivingRow } from "../../src/model/domain/models.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  catalogService,
  readModelService,
} from "../integrationUtils.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days: number): Date => new Date(Date.now() + days * DAY_MS);

describe("getProducerEServiceMonitoringArchiving", () => {
  const producerId: TenantId = generateId();
  const context = getMockContext({ authData: getMockAuthData(producerId) });
  const pagination = { offset: 0, limit: 50 };

  const scheduledDescriptor = (
    version: string,
    scope: ArchivingScope,
    archivableOn: Date,
    state: DescriptorState = descriptorState.archiving
  ): Descriptor => ({
    ...getMockDescriptor(),
    version,
    state,
    archivingSchedule: {
      archivableOn,
      startedAt: new Date(),
      scope,
      gracePeriodDays: 30,
    },
  });

  const addEService = async (
    descriptors: Descriptor[],
    {
      name,
      eserviceProducerId = producerId,
    }: { name?: string; eserviceProducerId?: TenantId } = {}
  ): Promise<EService> => {
    const mock = getMockEService();
    const eservice: EService = {
      ...mock,
      name: name ?? mock.name,
      producerId: eserviceProducerId,
      descriptors,
    };
    await addOneEService(eservice);
    return eservice;
  };

  const addAgreement = async (
    eservice: EService,
    descriptor: Descriptor,
    state: AgreementState,
    consumerId: TenantId = generateId()
  ): Promise<void> =>
    addOneAgreement({
      ...getMockAgreement(eservice.id, consumerId, state),
      producerId: eservice.producerId,
      descriptorId: descriptor.id,
    });

  const rowOf = (
    eservice: EService,
    descriptor: Descriptor,
    consumersCount: number
  ): ArchivingRow => ({
    eserviceId: eservice.id,
    eserviceName: eservice.name,
    descriptorId: descriptor.id,
    version: descriptor.version,
    consumersCount,
    archivableOn: descriptor.archivingSchedule!.archivableOn,
  });

  it("should list descriptor scoped archiving rows and exclude non archiving descriptors", async () => {
    const v2 = scheduledDescriptor("2", archivingScope.descriptor, inDays(10));
    const eservice = await addEService([
      {
        ...getMockDescriptor(),
        version: "1",
        state: descriptorState.published,
      },
      v2,
      {
        ...getMockDescriptor(),
        version: "3",
        state: descriptorState.published,
      },
    ]);

    expect(
      await catalogService.getProducerEServiceMonitoringArchiving(
        eservice.id,
        pagination,
        context
      )
    ).toEqual({
      results: [rowOf(eservice, v2, 0)],
      totalCount: 1,
    });
  });

  it("should list one row per version when the whole e-service is being archived", async () => {
    const archivableOn = inDays(30);
    const v1 = scheduledDescriptor(
      "1",
      archivingScope.eservice,
      archivableOn,
      descriptorState.archivingSuspended
    );
    const v2 = scheduledDescriptor("2", archivingScope.eservice, archivableOn);
    const eservice = await addEService([v1, v2]);
    const sharedConsumer = generateId<TenantId>();
    await addAgreement(eservice, v1, agreementState.active, sharedConsumer);
    await addAgreement(eservice, v2, agreementState.active, sharedConsumer);
    await addAgreement(eservice, v2, agreementState.suspended);

    const result = await catalogService.getProducerEServiceMonitoringArchiving(
      eservice.id,
      pagination,
      context
    );

    expect(result.results).toEqual([
      rowOf(eservice, v1, 1),
      rowOf(eservice, v2, 2),
    ]);
  });

  it("should exclude descriptors whose archivableOn is in the past", async () => {
    const past = scheduledDescriptor(
      "1",
      archivingScope.descriptor,
      inDays(-1)
    );
    const future = scheduledDescriptor(
      "2",
      archivingScope.descriptor,
      inDays(1)
    );
    const eservice = await addEService([past, future]);

    const result = await catalogService.getProducerEServiceMonitoringArchiving(
      eservice.id,
      pagination,
      context
    );

    expect(result.results).toEqual([rowOf(eservice, future, 0)]);
  });

  it("should count distinct consumers with Active or Suspended agreements only", async () => {
    const descriptor = scheduledDescriptor(
      "1",
      archivingScope.descriptor,
      inDays(5)
    );
    const eservice = await addEService([descriptor]);
    await addAgreement(eservice, descriptor, agreementState.active);
    await addAgreement(eservice, descriptor, agreementState.suspended);
    for (const state of [
      agreementState.pending,
      agreementState.archived,
      agreementState.draft,
      agreementState.rejected,
    ]) {
      await addAgreement(eservice, descriptor, state);
    }

    const result = await catalogService.getProducerEServiceMonitoringArchiving(
      eservice.id,
      pagination,
      context
    );

    expect(result.results).toEqual([rowOf(eservice, descriptor, 2)]);
  });

  it("should order by archivableOn and then by version, and paginate", async () => {
    const v1 = scheduledDescriptor("1", archivingScope.descriptor, inDays(20));
    const v2 = scheduledDescriptor("2", archivingScope.descriptor, inDays(10));
    const v10 = scheduledDescriptor(
      "10",
      archivingScope.descriptor,
      inDays(10)
    );
    const v3 = scheduledDescriptor("3", archivingScope.descriptor, inDays(5));
    const eservice = await addEService([v1, v10, v2, v3]);

    const all = await catalogService.getProducerEServiceMonitoringArchiving(
      eservice.id,
      pagination,
      context
    );
    expect(all.results).toEqual([
      rowOf(eservice, v3, 0),
      rowOf(eservice, v2, 0),
      rowOf(eservice, v10, 0),
      rowOf(eservice, v1, 0),
    ]);

    const page = await catalogService.getProducerEServiceMonitoringArchiving(
      eservice.id,
      { offset: 1, limit: 2 },
      context
    );
    expect(page).toEqual({
      results: [rowOf(eservice, v2, 0), rowOf(eservice, v10, 0)],
      totalCount: 4,
    });
  });

  it("should return no rows for an e-service not being archived", async () => {
    const eservice = await addEService([
      { ...getMockDescriptor(), state: descriptorState.published },
    ]);

    expect(
      await catalogService.getProducerEServiceMonitoringArchiving(
        eservice.id,
        pagination,
        context
      )
    ).toEqual({ results: [], totalCount: 0 });
  });

  it("should throw eServiceNotFound if the e-service does not exist", async () => {
    const eserviceId = generateId<EService["id"]>();

    await expect(
      catalogService.getProducerEServiceMonitoringArchiving(
        eserviceId,
        pagination,
        context
      )
    ).rejects.toThrowError(eServiceNotFound(eserviceId));
  });

  it("should throw operationForbidden if the requester is neither the producer nor the delegate", async () => {
    const eservice = await addEService(
      [scheduledDescriptor("1", archivingScope.descriptor, inDays(5))],
      { eserviceProducerId: generateId<TenantId>() }
    );

    await expect(
      catalogService.getProducerEServiceMonitoringArchiving(
        eservice.id,
        pagination,
        context
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should allow the delegate producer", async () => {
    const delegatorId = generateId<TenantId>();
    const descriptor = scheduledDescriptor(
      "1",
      archivingScope.descriptor,
      inDays(5)
    );
    const eservice = await addEService([descriptor], {
      eserviceProducerId: delegatorId,
    });
    await addOneDelegation(
      getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        delegatorId,
        delegateId: producerId,
        state: delegationState.active,
      })
    );

    const result = await catalogService.getProducerEServiceMonitoringArchiving(
      eservice.id,
      pagination,
      context
    );

    expect(result.results).toEqual([rowOf(eservice, descriptor, 0)]);
  });

  // The perimeter and the collapsed rows are used by the producer dashboard
  // (P8), which calls the shared read model function without an e-service.
  describe("getArchivingRows without an e-service filter", () => {
    const requesterId: TenantId = generateId();

    it("should restrict to own e-services and active delegations and collapse e-service scoped rows", async () => {
      const archivableOn = inDays(30);
      const own1 = scheduledDescriptor(
        "1",
        archivingScope.eservice,
        archivableOn
      );
      const own2 = scheduledDescriptor(
        "2",
        archivingScope.eservice,
        archivableOn
      );
      // A descriptor scoped schedule kept by an e-service archived as a whole.
      const own3 = scheduledDescriptor(
        "3",
        archivingScope.descriptor,
        inDays(2)
      );
      const own = await addEService([own1, own2, own3], {
        name: "A own",
        eserviceProducerId: requesterId,
      });
      const sharedConsumer = generateId<TenantId>();
      await addAgreement(own, own1, agreementState.active, sharedConsumer);
      await addAgreement(own, own2, agreementState.suspended, sharedConsumer);
      await addAgreement(own, own2, agreementState.active);

      const delegatorId = generateId<TenantId>();
      const delegated1 = scheduledDescriptor(
        "1",
        archivingScope.descriptor,
        archivableOn
      );
      const delegated = await addEService([delegated1], {
        name: "B delegated",
        eserviceProducerId: delegatorId,
      });
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedProducer,
          eserviceId: delegated.id,
          delegatorId,
          delegateId: requesterId,
          state: delegationState.active,
        })
      );

      // Not in the perimeter: other producer, revoked delegation.
      await addEService([
        scheduledDescriptor("1", archivingScope.descriptor, inDays(1)),
      ]);
      const revokedDelegatorId = generateId<TenantId>();
      const revoked = await addEService(
        [scheduledDescriptor("1", archivingScope.descriptor, inDays(1))],
        { eserviceProducerId: revokedDelegatorId }
      );
      await addOneDelegation(
        getMockDelegation({
          kind: delegationKind.delegatedProducer,
          eserviceId: revoked.id,
          delegatorId: revokedDelegatorId,
          delegateId: requesterId,
          state: delegationState.revoked,
        })
      );

      const collapsed = await readModelService.getArchivingRows(
        requesterId,
        { collapseEServiceScope: true },
        pagination
      );
      expect(collapsed).toEqual({
        results: [
          {
            eserviceId: own.id,
            eserviceName: own.name,
            descriptorId: own3.id,
            version: "3",
            consumersCount: 0,
            archivableOn: own3.archivingSchedule!.archivableOn,
          },
          {
            eserviceId: own.id,
            eserviceName: own.name,
            descriptorId: undefined,
            version: undefined,
            // Distinct across the collapsed descriptors.
            consumersCount: 2,
            archivableOn,
          },
          {
            eserviceId: delegated.id,
            eserviceName: delegated.name,
            descriptorId: delegated1.id,
            version: "1",
            consumersCount: 0,
            archivableOn,
          },
        ],
        totalCount: 3,
      });

      const perVersion = await readModelService.getArchivingRows(
        requesterId,
        { collapseEServiceScope: false },
        pagination
      );
      expect(
        perVersion.results.map((r) => [
          r.eserviceName,
          r.version,
          r.consumersCount,
        ])
      ).toEqual([
        [own.name, "3", 0],
        [own.name, "1", 1],
        [own.name, "2", 2],
        [delegated.name, "1", 0],
      ]);
    });
  });
});
