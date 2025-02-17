import { genericLogger } from "pagopa-interop-commons";
import {
  addSomeRandomDelegations,
  getMockAgreement,
  getMockDelegation,
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
  getRandomAuthData,
} from "pagopa-interop-commons-test/index.js";
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

    const retrievedDocumentByConsumer = await agreementService.getAgreementById(
      agreement.id,
      {
        authData: getRandomAuthData(consumer.id),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );
    expect(retrievedDocumentByConsumer).toEqual(agreement);

    const retrievedDocumentByProducer = await agreementService.getAgreementById(
      agreement.id,
      {
        authData: getRandomAuthData(producer.id),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      }
    );
    expect(retrievedDocumentByProducer).toEqual(agreement);

    const retrievedDocumentByProducerDelegate =
      await agreementService.getAgreementById(agreement.id, {
        authData: getRandomAuthData(producerDelegate.id),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      });
    expect(retrievedDocumentByProducerDelegate).toEqual(agreement);

    const retrievedDocumentByConsumerDelegate =
      await agreementService.getAgreementById(agreement.id, {
        authData: getRandomAuthData(consumerDelegate.id),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      });
    expect(retrievedDocumentByConsumerDelegate).toEqual(agreement);
  });

  it(`should throw an organizationNotAllowed error when the requester is
    not the consumer, producer, consumer delegate, or producer delegate`, async () => {
    const agreement = getMockAgreement();

    await addOneAgreement(agreement);

    const authData = getRandomAuthData();
    await expect(
      agreementService.getAgreementById(agreement.id, {
        authData,
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(organizationNotAllowed(authData.organizationId));
  });

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    const agreementId = generateId<AgreementId>();

    await addOneAgreement(getMockAgreement());

    await expect(
      agreementService.getAgreementById(agreementId, {
        authData: getRandomAuthData(),
        serviceName: "",
        correlationId: generateId(),
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });
});
