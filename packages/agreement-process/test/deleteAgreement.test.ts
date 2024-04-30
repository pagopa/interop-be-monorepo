/* eslint-disable functional/no-let */
import {
  decodeProtobufPayload,
  getMockAgreement,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import { describe, expect, it, vi } from "vitest";
import { v4 as uuidv4 } from "uuid";
import {
  AgreementDeletedV1,
  AgreementId,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import { fileManagerDeleteError } from "pagopa-interop-commons";
import { agreementDeletableStates } from "../src/model/domain/validators.js";

import { config } from "../src/utilities/config.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  operationNotAllowed,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  readLastAgreementEvent,
  agreementService,
  fileManager,
} from "./vitestSetup.js";
import { getMockConsumerDocument } from "./mocks.js";

describe("delete agreement", () => {
  it("should succeed when requester is Consumer and the Agreement is in a deletable state", async () => {
    vi.spyOn(fileManager, "delete");
    const agreementId = generateId<AgreementId>();
    const agreement = {
      ...getMockAgreement(),
      id: agreementId,
      state: randomArrayItem(agreementDeletableStates),
      consumerDocuments: [
        getMockConsumerDocument(agreementId, "doc1"),
        getMockConsumerDocument(agreementId, "doc2"),
      ],
    };
    await addOneAgreement(agreement);

    await fileManager.storeBytes(
      config.s3Bucket,
      `${config.consumerDocumentsPath}/${agreementId}`,
      agreement.consumerDocuments[0].id,
      agreement.consumerDocuments[0].name,
      Buffer.from("test content")
    );

    expect(await fileManager.listFiles(config.s3Bucket)).toContain(
      agreement.consumerDocuments[0].path
    );

    await fileManager.storeBytes(
      config.s3Bucket,
      `${config.consumerDocumentsPath}/${agreementId}`,
      agreement.consumerDocuments[1].id,
      agreement.consumerDocuments[1].name,
      Buffer.from("test content")
    );

    expect(await fileManager.listFiles(config.s3Bucket)).toContain(
      agreement.consumerDocuments[1].path
    );

    const authData = getRandomAuthData(agreement.consumerId);
    await agreementService.deleteAgreementById(
      agreement.id,
      authData,
      uuidv4()
    );

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    expect(agreementEvent).toMatchObject({
      type: "AgreementDeleted",
      event_version: 1,
      version: "1",
      stream_id: agreement.id,
    });

    const agreementDeletedId = decodeProtobufPayload({
      messageType: AgreementDeletedV1,
      payload: agreementEvent.data,
    }).agreementId;

    expect(agreementDeletedId).toEqual(agreement.id);

    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      agreement.consumerDocuments[0].path
    );
    expect(fileManager.delete).toHaveBeenCalledWith(
      config.s3Bucket,
      agreement.consumerDocuments[1].path
    );
    expect(await fileManager.listFiles(config.s3Bucket)).not.toContain(
      agreement.consumerDocuments[0].path
    );
    expect(await fileManager.listFiles(config.s3Bucket)).not.toContain(
      agreement.consumerDocuments[1].path
    );
  });

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    await addOneAgreement(getMockAgreement());
    const authData = getRandomAuthData();
    const agreementId = generateId<AgreementId>();
    await expect(
      agreementService.deleteAgreementById(agreementId, authData, uuidv4())
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw operationNotAllowed when the requester is not the Consumer", async () => {
    const authData = getRandomAuthData();
    const agreement = getMockAgreement();
    await addOneAgreement(agreement);
    await expect(
      agreementService.deleteAgreementById(agreement.id, authData, uuidv4())
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw agreementNotInExpectedState when the agreement is not in a deletable state", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (s) => !agreementDeletableStates.includes(s)
        )
      ),
    };
    await addOneAgreement(agreement);
    const authData = getRandomAuthData(agreement.consumerId);
    await expect(
      agreementService.deleteAgreementById(agreement.id, authData, uuidv4())
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });

  it("should fail if the file deletion fails", async () => {
    // eslint-disable-next-line functional/immutable-data
    config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure

    const agreementId = generateId<AgreementId>();
    const agreement = {
      ...getMockAgreement(),
      id: agreementId,
      state: randomArrayItem(agreementDeletableStates),
      consumerDocuments: [getMockConsumerDocument(agreementId, "doc1")],
    };
    await addOneAgreement(agreement);
    await expect(
      agreementService.deleteAgreementById(
        agreement.id,
        getRandomAuthData(agreement.consumerId),
        uuidv4()
      )
    ).rejects.toThrowError(
      fileManagerDeleteError(
        agreement.consumerDocuments[0].path,
        config.s3Bucket,
        new Error("The specified bucket does not exist")
      )
    );
  });
});
