/* eslint-disable functional/no-let */
import { fileManagerDeleteError, genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockContextInternal,
  getMockDelegation,
  randomArrayItem,
  sortAgreementV2,
} from "pagopa-interop-commons-test";
import {
  AgreementDeletedByRevokedDelegationV2,
  AgreementId,
  agreementState,
  delegationKind,
  delegationState,
  EServiceId,
  generateId,
  TenantId,
  toAgreementV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { agreementDeletableStates } from "../../src/model/domain/agreement-validators.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
} from "../../src/model/domain/errors.js";
import { config } from "../../src/config/config.js";
import {
  addOneAgreement,
  addOneDelegation,
  agreementService,
  fileManager,
  readLastAgreementEvent,
  uploadDocument,
} from "../integrationUtils.js";
import { getMockConsumerDocument } from "../mockUtils.js";

describe("internal delete agreement", () => {
  it.each(agreementDeletableStates)(
    "should succeed the Agreement is in a deletable state (%s)",
    async (state) => {
      vi.spyOn(fileManager, "delete");
      const agreementId = generateId<AgreementId>();
      const consumerDocuments = [
        getMockConsumerDocument(agreementId, "doc1"),
        getMockConsumerDocument(agreementId, "doc2"),
      ];
      const agreement = {
        ...getMockAgreement(),
        id: agreementId,
        state,
        consumerDocuments,
      };

      const consumerDelegation = getMockDelegation({
        kind: delegationKind.delegatedConsumer,
        eserviceId: agreement.eserviceId,
        delegatorId: agreement.consumerId,
        state: delegationState.active,
      });

      await addOneAgreement(agreement);
      await addOneDelegation(consumerDelegation);

      await Promise.all(
        consumerDocuments.map((doc) =>
          uploadDocument(agreementId, doc.id, doc.name)
        )
      );

      await agreementService.internalDeleteAgreementAfterDelegationRevocation(
        agreement.id,
        consumerDelegation.id,
        getMockContextInternal({})
      );

      const agreementEvent = await readLastAgreementEvent(agreement.id);

      expect(agreementEvent).toMatchObject({
        type: "AgreementDeletedByRevokedDelegation",
        event_version: 2,
        version: "1",
        stream_id: agreement.id,
      });

      const actualData = decodeProtobufPayload({
        messageType: AgreementDeletedByRevokedDelegationV2,
        payload: agreementEvent.data,
      });

      expect({
        agreement: sortAgreementV2(actualData.agreement),
        delegationId: actualData.delegationId,
      }).toEqual({
        agreement: sortAgreementV2(toAgreementV2(agreement)),
        delegationId: consumerDelegation.id,
      });

      const filePaths = await fileManager.listFiles(
        config.s3Bucket,
        genericLogger
      );

      consumerDocuments.forEach((doc) => {
        expect(fileManager.delete).toHaveBeenCalledWith(
          config.s3Bucket,
          doc.path,
          genericLogger
        );

        expect(filePaths).not.toContain(doc.path);
      });
    }
  );

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      randomArrayItem(agreementDeletableStates)
    );

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: agreement.eserviceId,
      delegatorId: agreement.consumerId,
      state: delegationState.active,
    });

    await addOneDelegation(consumerDelegation);

    await expect(
      agreementService.internalDeleteAgreementAfterDelegationRevocation(
        agreement.id,
        consumerDelegation.id,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(agreementNotFound(agreement.id));
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

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: agreement.eserviceId,
      delegatorId: agreement.consumerId,
      state: delegationState.active,
    });

    await addOneDelegation(consumerDelegation);
    await addOneAgreement(agreement);

    await expect(
      agreementService.internalDeleteAgreementAfterDelegationRevocation(
        agreement.id,
        consumerDelegation.id,
        getMockContextInternal({})
      )
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
    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: agreement.eserviceId,
      delegatorId: agreement.consumerId,
      state: delegationState.active,
    });

    await addOneDelegation(consumerDelegation);
    await addOneAgreement(agreement);
    await expect(
      agreementService.internalDeleteAgreementAfterDelegationRevocation(
        agreement.id,
        consumerDelegation.id,
        getMockContextInternal({})
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
