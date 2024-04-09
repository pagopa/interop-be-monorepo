/* eslint-disable functional/no-let */
import {
  decodeProtobufPayload,
  getMockAgreement,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import { describe, expect, it, vi } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { AgreementDeletedV1 } from "pagopa-interop-models";
import { agreementDeletableStates } from "../src/model/domain/validators.js";

import { config } from "../src/utilities/config.js";
import {
  postgresDB,
  agreements,
  agreementService,
  fileManager,
} from "./agreementService.integration.test.js";
import {
  addOneAgreement,
  getMockConsumerDocument,
  readLastAgreementEvent,
} from "./utils.js";

export function testDeleteAgreement(): void {
  describe("delete agreement", () => {
    it("should succeed when requester is Consumer and the Agreement is in a deletable state", async () => {
      vi.spyOn(fileManager, "delete");
      const agreement = {
        ...getMockAgreement(),
        state: randomArrayItem(agreementDeletableStates),
        consumerDocuments: [
          getMockConsumerDocument("doc1"),
          getMockConsumerDocument("doc2"),
        ],
      };
      await addOneAgreement(agreement, postgresDB, agreements);

      await fileManager.storeBytes(
        config.s3Bucket,
        config.consumerDocumentsPath,
        agreement.consumerDocuments[0].id,
        agreement.consumerDocuments[0].name,
        Buffer.from("test content")
      );

      expect(await fileManager.listFiles(config.s3Bucket)).toContain(
        agreement.consumerDocuments[0].path
      );

      await fileManager.storeBytes(
        config.s3Bucket,
        config.consumerDocumentsPath,
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

      const agreementEvent = await readLastAgreementEvent(
        agreement.id,
        postgresDB
      );

      expect(agreementEvent).toMatchObject({
        type: "AgreementDeleted",
        event_version: 1,
        version: "0",
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
  });
}
