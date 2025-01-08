/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  DraftPurposeDeletedV2,
  Purpose,
  PurposeId,
  PurposeVersion,
  TenantId,
  WaitingForApprovalPurposeDeletedV2,
  delegationKind,
  delegationState,
  generateId,
  purposeVersionState,
  toPurposeV2,
  toReadModelEService,
} from "pagopa-interop-models";
import {
  getMockPurpose,
  writeInReadmodel,
  decodeProtobufPayload,
  getMockPurposeVersion,
  getRandomAuthData,
  getMockDelegation,
  addSomeRandomDelegations,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  organizationIsNotTheConsumer,
  purposeCannotBeDeleted,
  organizationNotAllowed,
} from "../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOnePurpose,
  eservices,
  getMockEService,
  purposeService,
  readLastPurposeEvent,
} from "./utils.js";

describe("deletePurpose", () => {
  it("should write on event-store for the deletion of a purpose (no versions)", async () => {
    const mockEService = getMockEService();
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    await purposeService.deletePurpose(mockPurpose.id, {
      authData: getRandomAuthData(mockPurpose.consumerId),
      correlationId: generateId(),
      logger: genericLogger,
      serviceName: "",
    });

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "DraftPurposeDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose));
  });
  it("should write on event-store for the deletion of a purpose (draft version)", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion(purposeVersionState.draft);
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    await purposeService.deletePurpose(mockPurpose.id, {
      authData: getRandomAuthData(mockPurpose.consumerId),
      correlationId: generateId(),
      logger: genericLogger,
      serviceName: "",
    });

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "DraftPurposeDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose));
  });
  it("should write on event-store for the deletion of a purpose (waitingForApproval version)", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion(
      purposeVersionState.waitingForApproval
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    await purposeService.deletePurpose(mockPurpose.id, {
      authData: getRandomAuthData(mockPurpose.consumerId),
      correlationId: generateId(),
      logger: genericLogger,
      serviceName: "",
    });

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "WaitingForApprovalPurposeDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: WaitingForApprovalPurposeDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose));
  });
  it("should succeed when requester is Consumer Delegate and the Purpose is in a deletable state", async () => {
    const authData = getRandomAuthData();
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion(purposeVersionState.draft);
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });

    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(mockPurpose, addOneDelegation);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    await purposeService.deletePurpose(mockPurpose.id, {
      authData,
      correlationId: generateId(),
      logger: genericLogger,
      serviceName: "",
    });

    const writtenEvent = await readLastPurposeEvent(mockPurpose.id);

    expect(writtenEvent).toMatchObject({
      stream_id: mockPurpose.id,
      version: "1",
      type: "DraftPurposeDeleted",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: DraftPurposeDeletedV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose));
  });
  it("should throw purposeNotFound if the purpose doesn't exist", async () => {
    const randomId: PurposeId = generateId();
    const mockPurpose = getMockPurpose();

    await addOnePurpose(mockPurpose);
    expect(
      purposeService.deletePurpose(randomId, {
        authData: getRandomAuthData(mockPurpose.consumerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(purposeNotFound(randomId));
  });
  it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
      purposeVersionState.draft
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
    };

    await addOnePurpose(mockPurpose);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.deletePurpose(mockPurpose.id, {
        authData: getRandomAuthData(mockEService.producerId),
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(
      organizationIsNotTheConsumer(mockEService.producerId)
    );
  });
  it.each(
    Object.values(purposeVersionState).filter(
      (state) =>
        state !== purposeVersionState.waitingForApproval &&
        state !== purposeVersionState.draft
    )
  )(
    "should throw purposeCannotBeDeleted if the purpose has a $s version ",
    async (state) => {
      const mockEService = getMockEService();
      const mockPurposeVersion = getMockPurposeVersion(state);

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.deletePurpose(mockPurpose.id, {
          authData: getRandomAuthData(mockPurpose.consumerId),
          correlationId: generateId(),
          logger: genericLogger,
          serviceName: "",
        })
      ).rejects.toThrowError(purposeCannotBeDeleted(mockPurpose.id));
    }
  );
  it("should throw organizationNotAllowed when the requester is the Consumer but there is a Consumer Delegation", async () => {
    const authData = getRandomAuthData();
    const mockEService = getMockEService();
    const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
      purposeVersionState.draft
    );
    const mockPurpose: Purpose = {
      ...getMockPurpose(),
      eserviceId: mockEService.id,
      versions: [mockPurposeVersion],
      consumerId: authData.organizationId,
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: mockPurpose.eserviceId,
      delegatorId: mockPurpose.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });
    await addOnePurpose(mockPurpose);
    await addOneDelegation(delegation);
    await writeInReadmodel(toReadModelEService(mockEService), eservices);

    expect(
      purposeService.deletePurpose(mockPurpose.id, {
        authData,
        correlationId: generateId(),
        logger: genericLogger,
        serviceName: "",
      })
    ).rejects.toThrowError(organizationNotAllowed(authData.organizationId));
  });
});
