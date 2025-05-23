/* eslint-disable functional/no-let */
import {
  getMockAgreement,
  getMockAuthData,
  decodeProtobufPayload,
  randomArrayItem,
  getMockDelegation,
  addSomeRandomDelegations,
  getMockContext,
  sortAgreementV2,
} from "pagopa-interop-commons-test";
import {
  AgreementId,
  DraftAgreementUpdatedV2,
  TenantId,
  agreementState,
  delegationKind,
  delegationState,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegateConsumer,
} from "../../src/model/domain/errors.js";
import { agreementUpdatableStates } from "../../src/model/domain/agreement-validators.js";
import {
  addOneAgreement,
  addOneDelegation,
  agreementService,
  readLastAgreementEvent,
} from "../integrationUtils.js";

describe("update agreement", () => {
  it("should succeed when requester is Consumer and the Agreement is in an updatable state", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementUpdatableStates),
    };
    await addOneAgreement(agreement);
    const authData = getMockAuthData(agreement.consumerId);
    const returnedAgreement = await agreementService.updateAgreement(
      agreement.id,
      { consumerNotes: "Updated consumer notes" },
      getMockContext({ authData })
    );

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    expect(agreementEvent).toMatchObject({
      type: "DraftAgreementUpdated",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementUptaded = decodeProtobufPayload({
      messageType: DraftAgreementUpdatedV2,
      payload: agreementEvent.data,
    }).agreement;

    expect(sortAgreementV2(actualAgreementUptaded)).toMatchObject(
      sortAgreementV2({
        ...toAgreementV2(agreement),
        consumerNotes: "Updated consumer notes",
      })
    );
    expect(sortAgreementV2(actualAgreementUptaded)).toMatchObject(
      sortAgreementV2(toAgreementV2(returnedAgreement))
    );
  });

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    await addOneAgreement(getMockAgreement());

    const authData = getMockAuthData();
    const agreementId = generateId<AgreementId>();
    await expect(
      agreementService.updateAgreement(
        agreementId,
        { consumerNotes: "Updated consumer notes" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw tenantIsNotTheConsumer when the requester is not the Consumer", async () => {
    const authData = getMockAuthData();
    const agreement = getMockAgreement();
    await addOneAgreement(agreement);
    await expect(
      agreementService.updateAgreement(
        agreement.id,
        { consumerNotes: "Updated consumer notes" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(authData.organizationId));
  });

  it("should throw agreementNotInExpectedState when the agreement is not in an updatable state", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (s) => !agreementUpdatableStates.includes(s)
        )
      ),
    };
    await addOneAgreement(agreement);
    const authData = getMockAuthData(agreement.consumerId);
    await expect(
      agreementService.updateAgreement(
        agreement.id,
        { consumerNotes: "Updated consumer notes" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });

  it("should succeed when requester is Consumer Delegate and the Agreement is in an updatable state", async () => {
    const authData = getMockAuthData();
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementUpdatableStates),
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: agreement.eserviceId,
      delegatorId: agreement.consumerId,
      delegateId: authData.organizationId,
      state: delegationState.active,
    });
    await addOneAgreement(agreement);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(agreement, addOneDelegation);

    const returnedAgreement = await agreementService.updateAgreement(
      agreement.id,
      { consumerNotes: "Updated consumer notes" },
      getMockContext({ authData })
    );

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    expect(agreementEvent).toMatchObject({
      type: "DraftAgreementUpdated",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementUpdated = decodeProtobufPayload({
      messageType: DraftAgreementUpdatedV2,
      payload: agreementEvent.data,
    }).agreement;

    expect(sortAgreementV2(actualAgreementUpdated)).toMatchObject(
      sortAgreementV2({
        ...toAgreementV2(agreement),
        consumerNotes: "Updated consumer notes",
      })
    );
    expect(sortAgreementV2(actualAgreementUpdated)).toMatchObject(
      sortAgreementV2(toAgreementV2(returnedAgreement))
    );
  });

  it("should throw tenantIsNotTheDelegateConsumer when the requester is the Consumer but there is a Consumer Delegation", async () => {
    const authData = getMockAuthData();
    const agreement = {
      ...getMockAgreement(),
      consumerId: authData.organizationId,
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: agreement.eserviceId,
      delegatorId: agreement.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
    });
    await addOneAgreement(agreement);
    await addOneDelegation(delegation);
    await expect(
      agreementService.updateAgreement(
        agreement.id,
        { consumerNotes: "Updated consumer notes" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegateConsumer(authData.organizationId, delegation.id)
    );
  });
});
