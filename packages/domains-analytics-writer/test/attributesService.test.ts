/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, expect, it, beforeEach } from "vitest";
import { getMockAttribute } from "pagopa-interop-commons-test";
import {
  Attribute,
  AttributeEventEnvelope,
  attributeKind,
  toAttributeV1,
} from "pagopa-interop-models";
import { handleAttributeMessageV1 } from "../src/handlers/attribute/consumerServiceV1.js";
import { dbContext, getAttributeFromDb } from "./utils.js";

describe("SQL Attribute Service - Events V1", () => {
  beforeEach(async () => {
    await dbContext.conn.none("TRUNCATE domains.attribute CASCADE;");
    await dbContext.conn.none("TRUNCATE deleting_by_id_table;");
  });

  it("AttributeAdded - certified", async () => {
    const attr: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.certified,
      code: "123456",
      origin: "certifier-id",
    };

    const message: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: attr.id,
      version: 5,
      type: "AttributeAdded",
      event_version: 1,
      data: { attribute: toAttributeV1(attr) },
      log_date: new Date(),
    };

    await handleAttributeMessageV1([message], dbContext);
    const stored = await getAttributeFromDb(attr.id, dbContext);

    expect(stored?.id).toBe(attr.id);
    expect(stored?.kind).toBe(attributeKind.certified);
    expect(stored?.metadataVersion).toBe(5);
  });

  it("AttributeAdded - declared", async () => {
    const attr: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.declared,
    };

    const message: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: attr.id,
      version: 2,
      type: "AttributeAdded",
      event_version: 1,
      data: { attribute: toAttributeV1(attr) },
      log_date: new Date(),
    };

    await handleAttributeMessageV1([message], dbContext);
    const stored = await getAttributeFromDb(attr.id, dbContext);

    expect(stored?.kind).toBe(attributeKind.declared);
    expect(stored?.metadataVersion).toBe(2);
  });

  it("AttributeAdded - verified", async () => {
    const attr: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.verified,
    };

    const message: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: attr.id,
      version: 3,
      type: "AttributeAdded",
      event_version: 1,
      data: { attribute: toAttributeV1(attr) },
      log_date: new Date(),
    };

    await handleAttributeMessageV1([message], dbContext);
    const stored = await getAttributeFromDb(attr.id, dbContext);

    expect(stored?.kind).toBe(attributeKind.verified);
    expect(stored?.metadataVersion).toBe(3);
  });

  it("MaintenanceAttributeDeleted - removes attribute", async () => {
    const attr: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.certified,
    };

    const insertMessage: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: attr.id,
      version: 1,
      type: "AttributeAdded",
      event_version: 1,
      data: { attribute: toAttributeV1(attr) },
      log_date: new Date(),
    };
    await handleAttributeMessageV1([insertMessage], dbContext);

    const deleteMessage: AttributeEventEnvelope = {
      sequence_num: 2,
      stream_id: attr.id,
      version: 2,
      type: "MaintenanceAttributeDeleted",
      event_version: 1,
      data: { attributeId: attr.id } as any,
      log_date: new Date(),
    };

    await handleAttributeMessageV1([deleteMessage], dbContext);
    const stored = await getAttributeFromDb(attr.id, dbContext);

    expect(stored).toBeNull();
  });
});
