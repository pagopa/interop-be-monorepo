import { fail } from "assert";
import { v4 as uuidv4 } from "uuid";
import {
  Agreement,
  AgreementArchivedV2,
  AgreementId,
  AgreementV2,
  EServiceId,
  TenantId,
  agreementState,
  generateId,
  protobufDecoder,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import {
  getMockAgreement,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import { toAgreementV2 } from "../src/model/domain/toEvent.js";
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
} from "./agreementService.integration.test.js";

export const testArchiveAgreement = (): ReturnType<typeof describe> =>
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

      const agreementArchived = await agreementService.archiveAgreement(
        agreement.id,
        authData,
        uuidv4()
      );

      expect(agreementArchived.id).toBeDefined();
      if (!agreementArchived.id) {
        fail("Unhandled error: returned agreementId is undefined");
      }

      const actualAgreementData = await readLastAgreementEvent(
        agreementArchived.id,
        postgresDB
      );

      if (!actualAgreementData) {
        fail("Creation fails: agreement not found in event-store");
      }

      expect(actualAgreementData).toMatchObject({
        type: "AgreementArchived",
        event_version: 2,
        version: "1",
        stream_id: agreementArchived.id,
      });

      const actualAgreement: AgreementV2 | undefined = protobufDecoder(
        AgreementArchivedV2
      ).parse(actualAgreementData.data)?.agreement;

      if (!actualAgreement) {
        fail("impossible to decode AgreementArchivedV2 data");
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
        toAgreementV2(expectedAgreemenentArchived)
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

      const notArchivableState = randomArrayItem(
        Object.values(agreementState).filter(
          (s) => !agreementArchivableStates.includes(s)
        )
      );
      const agreement = getMockAgreement(
        eserviceId,
        authData.organizationId,
        notArchivableState
      );

      await addOneAgreement(agreement, postgresDB, agreements);

      await expect(
        agreementService.archiveAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(
        agreementNotInExpectedState(agreement.id, notArchivableState)
      );
    });
  });
