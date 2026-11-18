/* eslint-disable functional/no-let */
import { fileManagerDeleteError, genericLogger } from "pagopa-interop-commons";
import {
  addSomeRandomDelegations,
  decodeProtobufPayload,
  getMockAgreement,
  getMockContext,
  getMockDelegation,
  getMockAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  AgreementDeletedV2,
  AgreementId,
  agreementState,
  delegationKind,
  delegationState,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "../../src/config/config.js";
import { agreementDeletableStates } from "../../src/model/domain/agreement-validators.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegateConsumer,
} from "../../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneDelegation,
  agreementService,
  fileManager,
  readLastAgreementEvent,
  uploadDocument,
} from "../integrationUtils.js";
import { getMockConsumerDocument } from "../mockUtils.js";

describe("delete agreement", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(agreementDeletableStates)(
    "should succeed when requester is Consumer and the Agreement is in a deletable state (%s)",
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
      await addOneAgreement(agreement);

      await Promise.all(
        consumerDocuments.map((doc) =>
          uploadDocument(agreementId, doc.id, doc.name)
        )
      );

      const authData = getMockAuthData(agreement.consumerId);
      await agreementService.deleteAgreementById(
        agreement.id,
        getMockContext({ authData })
      );

      const agreementEvent = await readLastAgreementEvent(agreement.id);

      expect(agreementEvent).toMatchObject({
        type: "AgreementDeleted",
        event_version: 2,
        version: "1",
        stream_id: agreement.id,
      });

      const agreementDeletedId = decodeProtobufPayload({
        messageType: AgreementDeletedV2,
        payload: agreementEvent.data,
      }).agreement?.id;

      expect(agreementDeletedId).toEqual(agreement.id);

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

  it("should succeed when requester is Consumer Delegate and the Agreement is in a deletable state", async () => {
    vi.spyOn(fileManager, "delete");
    const agreementId = generateId<AgreementId>();
    const consumerDocuments = [
      getMockConsumerDocument(agreementId, "doc1"),
      getMockConsumerDocument(agreementId, "doc2"),
    ];

    const agreement = {
      ...getMockAgreement(),
      id: agreementId,
      state: randomArrayItem(agreementDeletableStates),
      consumerDocuments,
    };

    const delegateId = generateId<TenantId>();
    const authData = getMockAuthData(delegateId);

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      eserviceId: agreement.eserviceId,
      delegatorId: agreement.consumerId,
      delegateId,
      state: delegationState.active,
    });

    await addOneAgreement(agreement);
    await addOneDelegation(delegation);
    await addSomeRandomDelegations(agreement, addOneDelegation);

    await Promise.all(
      consumerDocuments.map((doc) =>
        uploadDocument(agreementId, doc.id, doc.name)
      )
    );

    await agreementService.deleteAgreementById(
      agreement.id,
      getMockContext({ authData })
    );

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    expect(agreementEvent).toMatchObject({
      type: "AgreementDeleted",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const agreementDeletedId = decodeProtobufPayload({
      messageType: AgreementDeletedV2,
      payload: agreementEvent.data,
    }).agreement?.id;

    expect(agreementDeletedId).toEqual(agreement.id);

    const filePaths = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    // eslint-disable-next-line sonarjs/no-identical-functions
    consumerDocuments.forEach((doc) => {
      expect(fileManager.delete).toHaveBeenCalledWith(
        config.s3Bucket,
        doc.path,
        genericLogger
      );

      expect(filePaths).not.toContain(doc.path);
    });
  });

  it("should throw tenantIsNotTheConsumer when the requester is the Consumer but there is a Consumer Delegation", async () => {
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
      agreementService.deleteAgreementById(
        agreement.id,
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegateConsumer(authData.organizationId, delegation.id)
    );
  });

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    await addOneAgreement(getMockAgreement());
    const authData = getMockAuthData();
    const agreementId = generateId<AgreementId>();
    await expect(
      agreementService.deleteAgreementById(
        agreementId,
        getMockContext({ authData })
      )
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw tenantIsNotTheConsumer when the requester is not the Consumer", async () => {
    const authData = getMockAuthData();
    const agreement = getMockAgreement();
    await addOneAgreement(agreement);
    await expect(
      agreementService.deleteAgreementById(
        agreement.id,
        getMockContext({ authData })
      )
    ).rejects.toThrowError(tenantIsNotTheConsumer(authData.organizationId));
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
    const authData = getMockAuthData(agreement.consumerId);
    await expect(
      agreementService.deleteAgreementById(
        agreement.id,
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });

  it("should persist the event and log a deletion failure without failing", async () => {
    const agreementId = generateId<AgreementId>();
    const agreement = {
      ...getMockAgreement(),
      id: agreementId,
      state: randomArrayItem(agreementDeletableStates),
      consumerDocuments: [getMockConsumerDocument(agreementId, "doc1")],
    };
    await addOneAgreement(agreement);
    const document = agreement.consumerDocuments[0];
    const content = Buffer.from("original document");
    await fileManager.storeBytesByKey(
      config.s3Bucket,
      document.path,
      content,
      genericLogger
    );
    const deletionError = fileManagerDeleteError(
      document.path,
      config.s3Bucket,
      new Error("Simulated deletion failure")
    );
    vi.spyOn(fileManager, "delete").mockRejectedValueOnce(deletionError);
    const logError = vi.spyOn(genericLogger, "error").mockReturnThis();

    await expect(
      agreementService.deleteAgreementById(
        agreement.id,
        getMockContext({ authData: getMockAuthData(agreement.consumerId) })
      )
    ).resolves.toBeUndefined();

    expect(
      await fileManager.get(config.s3Bucket, document.path, genericLogger)
    ).toEqual(new Uint8Array(content));
    expect(await readLastAgreementEvent(agreement.id)).toMatchObject({
      type: "AgreementDeleted",
      version: "1",
    });
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining(`s3://${config.s3Bucket}/${document.path}`)
    );
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining(deletionError.message)
    );
  });
});
