/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/immutable-data */
/* eslint-disable fp/no-delete */

import { generateMock } from "@anatine/zod-mock";
import { getMockAgreement } from "pagopa-interop-commons-test";
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
  AgreementId,
  AgreementStateV1,
  AgreementSuspendedV1,
  AgreementUpdatedV1,
  agreementState,
  fromAgreementV1,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  toAgreementDocumentV1,
  toAgreementV1,
} from "pagopa-interop-commons-test";
import { handleMessageV1 } from "../src/consumerServiceV1.js";
import { agreementReadModelService, agreementWriterService } from "./utils.js";

describe("events V1", async () => {
  it("should create an agreement", async () => {
    const id = generateId<AgreementId>();
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
      version: 2,
      type: "AgreementAdded",
      data: newAgreement,
      log_date: new Date(),
    };
    await handleMessageV1(message, agreementWriterService);

    const agreement = await agreementReadModelService.getAgreementById(id);

    expect(agreement?.data).toStrictEqual(
      fromAgreementV1(newAgreement.agreement!)
    );
  });

  it("should delete an agreement", async () => {
    const agreement = getMockAgreement();
    agreement.signedContract = undefined;
    await agreementWriterService.upsertAgreement(agreement, 1);
    const agreementDeleted: AgreementDeletedV1 = {
      agreementId: agreement.id,
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 2,
      type: "AgreementDeleted",
      data: agreementDeleted,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreementWriterService);

    const actualAgreement = await agreementReadModelService.getAgreementById(
      agreement.id
    );

    expect(actualAgreement).toBeUndefined();
  });

  it("should update an agreement", async () => {
    const agreement = getMockAgreement();
    agreement.signedContract = undefined;
    await agreementWriterService.upsertAgreement(agreement, 1);
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
      version: 2,
      type: "AgreementUpdated",
      data: agreementUpdated,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreementWriterService);

    const actualAgreement = await agreementReadModelService.getAgreementById(
      agreement.id
    );

    expect(actualAgreement).not.toBeNull();

    expect(actualAgreement?.data).toStrictEqual(
      fromAgreementV1(agreementUpdated.agreement!)
    );
  });

  it("should add a consumer document to an agreement", async () => {
    const agreement = { ...getMockAgreement(), signedContract: undefined };
    await agreementWriterService.upsertAgreement(agreement, 1);
    const agreementConsumerDocument = generateMock(AgreementDocument);

    const consumerDocumentAdded: AgreementConsumerDocumentAddedV1 = {
      document: toAgreementDocumentV1(agreementConsumerDocument),
      agreementId: agreement.id,
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 2,
      type: "AgreementConsumerDocumentAdded",
      data: consumerDocumentAdded,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreementWriterService);

    const actualAgreement = await agreementReadModelService.getAgreementById(
      agreement.id
    );
    const updatedActualAgreement = {
      ...actualAgreement,
      data: {
        ...actualAgreement?.data,
        signedContract: undefined,
      },
    };

    expect(updatedActualAgreement).not.toBeNull();

    expect(updatedActualAgreement?.data).toStrictEqual({
      ...agreement,
      consumerDocuments: [
        ...agreement.consumerDocuments,
        agreementConsumerDocument,
      ],
    });
  });

  it("should remove a consumer document from an agreement", async () => {
    const agreementConsumerDocument = generateMock(AgreementDocument);
    const agreement = {
      ...getMockAgreement(),
      consumerDocuments: [agreementConsumerDocument],
    };
    agreement.signedContract = undefined;
    await agreementWriterService.upsertAgreement(agreement, 1);
    const consumerDocumentRemoved: AgreementConsumerDocumentRemovedV1 = {
      documentId: agreementConsumerDocument.id,
      agreementId: agreement.id,
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 2,
      type: "AgreementConsumerDocumentRemoved",
      data: consumerDocumentRemoved,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreementWriterService);

    const actualAgreement = await agreementReadModelService.getAgreementById(
      agreement.id
    );

    expect(actualAgreement).not.toBeNull();

    expect(
      actualAgreement?.data.consumerDocuments.map((cd) => cd.id)
    ).not.toContain(agreementConsumerDocument.id);
  });

  it("should add an agreement contract", async () => {
    const agreementContract = generateMock(AgreementDocument);
    const agreement: Agreement = {
      ...getMockAgreement(),
      contract: agreementContract,
    };
    agreement.signedContract = undefined;
    await agreementWriterService.upsertAgreement(agreement, 1);
    const agreementContractAdded: AgreementContractAddedV1 = {
      contract: toAgreementDocumentV1(agreementContract),
      agreementId: agreement.id,
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 2,
      type: "AgreementContractAdded",
      data: agreementContractAdded,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreementWriterService);

    const actualAgreement = await agreementReadModelService.getAgreementById(
      agreement.id
    );

    const updatedActualAgreement = {
      ...actualAgreement,
      data: {
        ...actualAgreement?.data,
        signedContract: undefined,
      },
    };

    expect(updatedActualAgreement).not.toBeNull();

    expect(updatedActualAgreement?.data).toStrictEqual({
      ...agreement,
      contract: agreementContract,
    });
  });

  it("should activate an agreement", async () => {
    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.pending,
      signedContract: undefined,
    };
    agreement.signedContract = undefined;
    await agreementWriterService.upsertAgreement(agreement, 1);
    const activatedAgreement: Agreement = {
      ...agreement,
      state: agreementState.active,
      signedContract: undefined,
    };
    const payload: AgreementActivatedV1 = {
      agreement: toAgreementV1(activatedAgreement),
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 2,
      type: "AgreementActivated",
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreementWriterService);

    const retrievedAgreement = await agreementReadModelService.getAgreementById(
      agreement.id
    );

    const updatedRetrievedAgreement = {
      ...retrievedAgreement,
      data: {
        ...retrievedAgreement?.data,
        signedContract: undefined,
      },
    };

    expect(updatedRetrievedAgreement).not.toBeNull();

    expect(updatedRetrievedAgreement?.data).toStrictEqual(activatedAgreement);
  });

  it("should suspend an agreement", async () => {
    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      signedContract: undefined,
    };
    await agreementWriterService.upsertAgreement(agreement, 1);
    const suspendedAgreement: Agreement = {
      ...agreement,
      state: agreementState.active,
      signedContract: undefined,
    };
    const payload: AgreementSuspendedV1 = {
      agreement: toAgreementV1(suspendedAgreement),
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 2,
      type: "AgreementSuspended",
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreementWriterService);

    const retrievedAgreement = await agreementReadModelService.getAgreementById(
      agreement.id
    );

    const updatedRetrievedAgreement = {
      ...retrievedAgreement,
      data: {
        ...retrievedAgreement?.data,
        signedContract: undefined,
      },
    };

    expect(updatedRetrievedAgreement).not.toBeNull();
    expect(updatedRetrievedAgreement?.data).toStrictEqual(suspendedAgreement);
  });

  it("should deactivate an agreement", async () => {
    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
      signedContract: undefined,
    };
    await agreementWriterService.upsertAgreement(agreement, 1);
    const deactivatedAgreement: Agreement = {
      ...agreement,
      state: agreementState.active,
      signedContract: undefined,
    };
    const payload: AgreementActivatedV1 = {
      agreement: toAgreementV1(deactivatedAgreement),
    };

    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 2,
      type: "AgreementDeactivated",
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreementWriterService);

    const retrievedAgreement = await agreementReadModelService.getAgreementById(
      agreement.id
    );
    const updatedRetrievedAgreement = {
      ...retrievedAgreement,
      data: {
        ...retrievedAgreement?.data,
        signedContract: undefined,
      },
    };

    expect(updatedRetrievedAgreement).not.toBeNull();

    expect(updatedRetrievedAgreement?.data).toStrictEqual(deactivatedAgreement);
  });

  it("should update the verified attributes of an agreement", async () => {
    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.active,
    };
    await agreementWriterService.upsertAgreement(agreement, 1);
    const updatedAgreement: Agreement = {
      ...agreement,
      signedContract: undefined,
      verifiedAttributes: [{ id: generateId() }],
    };
    const payload: AgreementActivatedV1 = {
      agreement: toAgreementV1(updatedAgreement),
    };
    const message: AgreementEventEnvelope = {
      event_version: 1,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 2,
      type: "VerifiedAttributeUpdated",
      data: payload,
      log_date: new Date(),
    };

    await handleMessageV1(message, agreementWriterService);

    const retrievedAgreement = await agreementReadModelService.getAgreementById(
      agreement.id
    );
    const updatedRetrievedAgreement = {
      ...retrievedAgreement,
      data: {
        ...retrievedAgreement?.data,
        signedContract: undefined,
      },
    };

    expect(updatedRetrievedAgreement).not.toBeNull();
    expect(updatedRetrievedAgreement?.data).toStrictEqual(updatedAgreement);
  });
});
