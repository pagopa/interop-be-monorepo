/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { generateMock } from "@anatine/zod-mock";
import {
  getMockAgreement,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementActivatedV1,
  AgreementAddedV1,
  AgreementConsumerDocumentAddedV1,
  AgreementConsumerDocumentRemovedV1,
  AgreementContractAddedV1,
  AgreementDeletedV1,
  AgreementDocument,
  AgreementEventEnvelope,
  AgreementStateV1,
  AgreementSuspendedV1,
  AgreementUpdatedV1,
  agreementState,
  fromAgreementV1,
  generateId,
  toReadModelAgreement,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  toAgreementDocumentV1,
  toAgreementV1,
} from "pagopa-interop-commons-test";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import { agreements } from "./utils.js";

describe("events V1", async () => {
  it("should create an agreement", async () => {
    const id = generateId();
    const newAgreement: AgreementAddedV1 = {
      agreement: {
        id,
        eserviceId: generateId(),
        descriptorId: generateId(),
        producerId: generateId(),
        consumerId: generateId(),
        state: AgreementStateV1.ACTIVE,
        certifiedAttributes: [],
        declaredAttributes: [],
        verifiedAttributes: [],
        createdAt: BigInt(new Date().getTime()),
        consumerDocuments: [],
      },
    };
    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: id,
      version: 1,
      type: "AgreementAdded",
      data: newAgreement,
      log_date: new Date(),
    };
    await handleMessageV1(message, agreements);

    const agreement = await agreements.findOne({
      "data.id": id.toString(),
    });

    expect(agreement?.data).toEqual(
      toReadModelAgreement(fromAgreementV1(newAgreement.agreement!))
    );
  });

  it("should delete an agreement", async () => {
    const agreement = getMockAgreement();
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);

    const agreementDeleted: AgreementDeletedV1 = {
      agreementId: agreement.id,
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementDeleted",
      data: agreementDeleted,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreements);

    const actualAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(actualAgreement).toBeNull();
  });

  it("should update an agreement", async () => {
    const agreement = getMockAgreement();
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);

    const agreementUpdated: AgreementUpdatedV1 = {
      agreement: {
        id: agreement.id,
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
        producerId: agreement.producerId,
        consumerId: agreement.consumerId,
        state: AgreementStateV1.SUSPENDED,
        certifiedAttributes: [],
        declaredAttributes: [],
        verifiedAttributes: [],
        createdAt: BigInt(new Date().getTime()),
        consumerDocuments: [],
      },
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementUpdated",
      data: agreementUpdated,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreements);

    const actualAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(actualAgreement).not.toBeNull();

    expect(actualAgreement?.data).toEqual(
      toReadModelAgreement(fromAgreementV1(agreementUpdated.agreement!))
    );
  });

  it("should add a consumer document to an agreement", async () => {
    const agreement = getMockAgreement();
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);

    const agreementConsumerDocument = generateMock(AgreementDocument);

    const consumerDocumentAdded: AgreementConsumerDocumentAddedV1 = {
      document: toAgreementDocumentV1(agreementConsumerDocument),
      agreementId: agreement.id,
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementConsumerDocumentAdded",
      data: consumerDocumentAdded,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreements);

    const actualAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(actualAgreement).not.toBeNull();

    expect(actualAgreement?.data).toMatchObject(
      toReadModelAgreement({
        ...agreement,
        consumerDocuments: [
          ...agreement.consumerDocuments,
          agreementConsumerDocument,
        ],
      })
    );
  });

  it("should remove a consumer document from an agreement", async () => {
    const agreementConsumerDocument = generateMock(AgreementDocument);
    const agreement = {
      ...getMockAgreement(),
      consumerDocuments: [agreementConsumerDocument],
    };
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);

    const consumerDocumentRemoved: AgreementConsumerDocumentRemovedV1 = {
      documentId: agreementConsumerDocument.id,
      agreementId: agreement.id,
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementConsumerDocumentRemoved",
      data: consumerDocumentRemoved,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreements);

    const actualAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(actualAgreement).not.toBeNull();

    expect(
      actualAgreement?.data.consumerDocuments.map((cd) => cd.id)
    ).not.toContain(agreementConsumerDocument.id);
  });

  it("should add an agreement contract", async () => {
    const agreementContract = generateMock(AgreementDocument);
    const agreement = getMockAgreement();
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);

    const agreementContractAdded: AgreementContractAddedV1 = {
      contract: toAgreementDocumentV1(agreementContract),
      agreementId: agreement.id,
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementContractAdded",
      data: agreementContractAdded,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreements);

    const actualAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(actualAgreement).not.toBeNull();

    expect(actualAgreement?.data).toMatchObject(
      toReadModelAgreement({
        ...agreement,
        contract: agreementContract,
      })
    );
  });

  it("should activate an agreement", async () => {
    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.pending,
    };
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);

    const activatedAgreement: Agreement = {
      ...agreement,
      state: agreementState.active,
    };
    const payload: AgreementActivatedV1 = {
      agreement: toAgreementV1(activatedAgreement),
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementActivated",
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreements);

    const retrievedAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(retrievedAgreement).not.toBeNull();

    expect(retrievedAgreement?.data).toEqual(
      toReadModelAgreement(activatedAgreement)
    );
  });

  it("should suspend an agreement", async () => {
    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
    };
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);

    const suspendedAgreement: Agreement = {
      ...agreement,
      state: agreementState.active,
    };
    const payload: AgreementSuspendedV1 = {
      agreement: toAgreementV1(suspendedAgreement),
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementSuspended",
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreements);

    const retrievedAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(retrievedAgreement).not.toBeNull();

    expect(retrievedAgreement?.data).toEqual(
      toReadModelAgreement(suspendedAgreement)
    );
  });

  it("should deactivate an agreement", async () => {
    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
    };
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);

    const deactivatedAgreement: Agreement = {
      ...agreement,
      state: agreementState.active,
    };
    const payload: AgreementActivatedV1 = {
      agreement: toAgreementV1(deactivatedAgreement),
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "AgreementDeactivated",
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreements);

    const retrievedAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(retrievedAgreement).not.toBeNull();

    expect(retrievedAgreement?.data).toEqual(
      toReadModelAgreement(deactivatedAgreement)
    );
  });

  it("should update the verified attributes of an agreement", async () => {
    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
    };
    await writeInReadmodel(toReadModelAgreement(agreement), agreements);

    const updatedAgreement: Agreement = {
      ...agreement,
      verifiedAttributes: [{ id: generateId() }],
    };
    const payload: AgreementActivatedV1 = {
      agreement: toAgreementV1(updatedAgreement),
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: "VerifiedAttributeUpdated",
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreements);

    const retrievedAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(retrievedAgreement).not.toBeNull();

    expect(retrievedAgreement?.data).toEqual(
      toReadModelAgreement(updatedAgreement)
    );
  });
});
