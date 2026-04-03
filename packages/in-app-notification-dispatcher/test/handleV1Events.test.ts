import { getMockContext } from "pagopa-interop-commons-test";
import {
  TenantEventEnvelope,
  AgreementEventEnvelope,
  EServiceEventEnvelope,
  PurposeEventEnvelope,
  AuthorizationEventEnvelope,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { handleTenantEvent } from "../src/handlers/tenants/handleTenantEvent.js";
import { handleAgreementEvent } from "../src/handlers/agreements/handleAgreementEvent.js";
import { handleEServiceEvent } from "../src/handlers/eservices/handleEserviceEvent.js";
import { handlePurposeEvent } from "../src/handlers/purposes/handlePurposeEvent.js";
import { handleAuthorizationEvent } from "../src/handlers/authorizations/handleAuthorizationEvent.js";
import { readModelService } from "./utils.js";

const { logger } = getMockContext({});

describe("V1 events should be skipped", () => {
  it("should skip V1 tenant event", async () => {
    const decodedMessage: TenantEventEnvelope = {
      event_version: 1,
      type: "TenantCreated",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any,
      sequence_num: 1,
      stream_id: generateId(),
      version: 1,
      log_date: new Date(),
    };

    const result = await handleTenantEvent(
      decodedMessage,
      logger,
      readModelService
    );

    expect(result).toEqual([]);
  });

  it("should skip V1 agreement event", async () => {
    const decodedMessage: AgreementEventEnvelope = {
      event_version: 1,
      type: "AgreementAdded",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any,
      sequence_num: 1,
      stream_id: generateId(),
      version: 1,
      log_date: new Date(),
    };

    const result = await handleAgreementEvent(
      decodedMessage,
      logger,
      readModelService
    );

    expect(result).toEqual([]);
  });

  it("should skip V1 eservice event", async () => {
    const decodedMessage: EServiceEventEnvelope = {
      event_version: 1,
      type: "EServiceAdded",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any,
      sequence_num: 1,
      stream_id: generateId(),
      version: 1,
      log_date: new Date(),
    };

    const result = await handleEServiceEvent(
      decodedMessage,
      logger,
      readModelService
    );

    expect(result).toEqual([]);
  });

  it("should skip V1 purpose event", async () => {
    const decodedMessage: PurposeEventEnvelope = {
      event_version: 1,
      type: "PurposeCreated",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any,
      sequence_num: 1,
      stream_id: generateId(),
      version: 1,
      log_date: new Date(),
    };

    const result = await handlePurposeEvent(
      decodedMessage,
      logger,
      readModelService
    );

    expect(result).toEqual([]);
  });

  it("should skip V1 authorization event", async () => {
    const decodedMessage: AuthorizationEventEnvelope = {
      event_version: 1,
      type: "KeysAdded",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {} as any,
      sequence_num: 1,
      stream_id: generateId(),
      version: 1,
      log_date: new Date(),
    };

    const result = await handleAuthorizationEvent(
      decodedMessage,
      logger,
      readModelService
    );

    expect(result).toEqual([]);
  });
});
