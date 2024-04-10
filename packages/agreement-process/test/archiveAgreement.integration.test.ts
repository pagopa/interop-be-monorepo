import { fail } from "assert";
import { v4 as uuidv4 } from "uuid";
import {
  Agreement,
  AgreementId,
  AgreementUpdatedV1,
  AgreementV1,
  EServiceId,
  TenantId,
  agreementState,
  generateId,
  protobufDecoder,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  StoredEvent,
  getMockAgreement,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import { toAgreementV1 } from "../src/model/domain/toEvent.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  operationNotAllowed,
} from "../src/model/domain/errors.js";
import { agreementArchivableStates } from "../src/model/domain/validators.js";
import { addOneAgreement, readLastAgreementEvent } from "./utils.js";
import {
  agreementService,
  agreements,
  postgresDB,
} from "./agreementService.test.setup.js";

describe("archive agreement", () => {
  it("should succeed when the requester is the consumer and the agreement is in an archivable state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();

    const agreement = getMockAgreement(
      eserviceId,
      authData.organizationId,
      randomArrayItem(agreementArchivableStates)
    );

    await addOneAgreement(agreement, postgresDB, agreements);

    const agreementId = await agreementService.archiveAgreement(
      agreement.id,
      authData,
      uuidv4()
    );

    expect(agreementId).toBeDefined();
    if (!agreementId) {
      fail("Unhandled error: returned agreementId is undefined");
    }

    const actualAgreementData: StoredEvent | undefined =
      await readLastAgreementEvent(agreementId, postgresDB);

    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData).toMatchObject({
      type: "AgreementUpdated",
      event_version: 1,
      version: "0",
      stream_id: agreementId,
    });

    const actualAgreement: AgreementV1 | undefined = protobufDecoder(
      AgreementUpdatedV1
    ).parse(actualAgreementData.data)?.agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementAddedV1 data");
    }

    const expectedAgreemenentArchived: Agreement = {
      ...agreement,
      state: agreementState.archived,
      stamps: {
        ...agreement.stamps,
        archiving: {
          who: authData.userId,
          when: new Date(),
        },
      },
    };
    expect(actualAgreement).toMatchObject(
      toAgreementV1(expectedAgreemenentArchived)
    );

    vi.useRealTimers();
  });

  it("should throw a agreementNotFound error when the Agreement doesn't exist", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();

    const agreement = getMockAgreement(
      eserviceId,
      authData.organizationId,
      randomArrayItem(agreementArchivableStates)
    );

    await addOneAgreement(agreement, postgresDB, agreements);

    const agreementToArchiveId = generateId<AgreementId>();

    await expect(
      agreementService.archiveAgreement(
        agreementToArchiveId,
        authData,
        uuidv4()
      )
    ).rejects.toThrowError(agreementNotFound(agreementToArchiveId));
  });

  it("should throw a operationNotAllowed error when the requester is not the Agreement consumer", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();

    const agreement = getMockAgreement(
      eserviceId,
      generateId<TenantId>(),
      randomArrayItem(agreementArchivableStates)
    );

    await addOneAgreement(agreement, postgresDB, agreements);

    await expect(
      agreementService.archiveAgreement(agreement.id, authData, uuidv4())
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw a agreementNotInExpectedState error when the Agreement is not in a archivable states", async () => {
    const authData = getRandomAuthData();
    const eserviceId = generateId<EServiceId>();

    const state = randomArrayItem(
      Object.values(agreementState).filter(
        (s) => !agreementArchivableStates.includes(s)
      )
    );
    const agreement = getMockAgreement(
      eserviceId,
      authData.organizationId,
      state
    );

    await addOneAgreement(agreement, postgresDB, agreements);

    await expect(
      agreementService.archiveAgreement(agreement.id, authData, uuidv4())
    ).rejects.toThrowError(agreementNotInExpectedState(agreement.id, state));
  });
});
