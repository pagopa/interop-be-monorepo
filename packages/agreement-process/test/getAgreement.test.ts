import {
  addSomeRandomDelegations,
  getMockAgreement,
  getMockContext,
  getMockDelegation,
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  generateId,
  delegationKind,
  delegationState,
  AgreementId,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import {
  agreementNotFound,
  organizationNotAllowed,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOneTenant,
  agreementService,
} from "./utils.js";

describe("get agreement", () => {
  it(`should succeed when the requester is the consumer,
    producer, consumer delegate, or producer delegate`, async () => {
    const producer = getMockTenant();
    const consumer = getMockTenant();
    const producerDelegate = getMockTenant();
    const consumerDelegate = getMockTenant();
    const eservice = {
      ...getMockEService(),
      producerId: producer.id,
      consumerId: consumer.id,
      descriptors: [getMockDescriptorPublished()],
    };
    const agreement = {
      ...getMockAgreement(eservice.id),
      descriptorId: eservice.descriptors[0].id,
      producerId: producer.id,
      consumerId: consumer.id,
    };
    const producerDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegatorId: eservice.producerId,
      state: delegationState.active,
      delegateId: producerDelegate.id,
    });

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: agreement.eserviceId,
      delegatorId: agreement.consumerId,
      state: delegationState.active,
      delegateId: consumerDelegate.id,
    });

    await addOneTenant(producerDelegate);
    await addOneTenant(consumerDelegate);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOneDelegation(producerDelegation);
    await addOneDelegation(consumerDelegation);
    await addSomeRandomDelegations(agreement, addOneDelegation);

    const retrievedAgreementByConsumer =
      await agreementService.getAgreementById(
        agreement.id,
        getMockContext({ authData: getMockAuthData(consumer.id) })
      );
    expect(retrievedAgreementByConsumer.data).toEqual(agreement);

    const retrievedAgreementByProducer =
      await agreementService.getAgreementById(
        agreement.id,
        getMockContext({ authData: getMockAuthData(producer.id) })
      );
    expect(retrievedAgreementByProducer.data).toEqual(agreement);

    const retrievedAgreementByProducerDelegate =
      await agreementService.getAgreementById(
        agreement.id,
        getMockContext({ authData: getMockAuthData(producerDelegate.id) })
      );
    expect(retrievedAgreementByProducerDelegate.data).toEqual(agreement);

    const retrievedAgreementByConsumerDelegate =
      await agreementService.getAgreementById(
        agreement.id,
        getMockContext({ authData: getMockAuthData(consumerDelegate.id) })
      );
    expect(retrievedAgreementByConsumerDelegate.data).toEqual(agreement);
  });

  it(`should throw an organizationNotAllowed error when the requester is
    not the consumer, producer, consumer delegate, or producer delegate`, async () => {
    const agreement = getMockAgreement();

    await addOneAgreement(agreement);

    const authData = getMockAuthData();
    await expect(
      agreementService.getAgreementById(
        agreement.id,
        getMockContext({ authData })
      )
    ).rejects.toThrowError(organizationNotAllowed(authData.organizationId));
  });

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    const agreementId = generateId<AgreementId>();

    await addOneAgreement(getMockAgreement());

    await expect(
      agreementService.getAgreementById(agreementId, getMockContext({}))
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });
});
