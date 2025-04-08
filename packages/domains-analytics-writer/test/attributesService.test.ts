/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, beforeEach } from "vitest";
import { getMockAttribute } from "pagopa-interop-commons-test";
import {
  Attribute,
  AttributeEventEnvelope,
  attributeKind,
  generateId,
} from "pagopa-interop-models";
import { handleAttributeMessageV1 } from "../src/handlers/attribute/consumerServiceV1.js";
import { dbContext, getAttributeFromDb } from "./utils.js";

describe("SQL Attribute Service - Events V1", () => {
  beforeEach(async () => {
    await dbContext.conn.none("TRUNCATE domains.attribute CASCADE;");
    await dbContext.conn.none("TRUNCATE deleting_table;");
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
      data: { attribute: attr as any },
      log_date: new Date(),
    };

    await handleAttributeMessageV1([message], dbContext);
    const stored = await getAttributeFromDb(attr.id, dbContext);
    expect(stored?.length).toBe(1);
    expect(stored?.[0].id).toBe(attr.id);
    expect(stored?.[0].kind).toBe(attributeKind.certified);
    expect(stored?.[0].metadata_version).toBe(5);
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
      data: { attribute: attr as any },
      log_date: new Date(),
    };

    await handleAttributeMessageV1([message], dbContext);
    const stored = await getAttributeFromDb(attr.id, dbContext);
    expect(stored?.length).toBe(1);
    expect(stored?.[0].kind).toBe(attributeKind.declared);
    expect(stored?.[0].metadata_version).toBe(2);
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
      data: { attribute: attr as any },
      log_date: new Date(),
    };

    await handleAttributeMessageV1([message], dbContext);
    const stored = await getAttributeFromDb(attr.id, dbContext);
    expect(stored?.length).toBe(1);
    expect(stored?.[0].kind).toBe(attributeKind.verified);
    expect(stored?.[0].metadata_version).toBe(3);
  });

  it("AttributeAdded - deduplicates batch by attribute ID, keeps only record with highest metadata_version", async () => {
    const attr: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.verified,
    };

    const olderVersionMessage: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: attr.id,
      version: 10,
      type: "AttributeAdded",
      event_version: 1,
      data: { attribute: { ...attr } as any },
      log_date: new Date(),
    };

    const newerVersionMessage: AttributeEventEnvelope = {
      sequence_num: 2,
      stream_id: attr.id,
      version: 1,
      type: "AttributeAdded",
      event_version: 1,
      data: { attribute: { ...attr } as any },
      log_date: new Date(),
    };

    await handleAttributeMessageV1(
      [olderVersionMessage, newerVersionMessage],
      dbContext
    );

    const stored = await getAttributeFromDb(attr.id, dbContext);
    expect(stored?.length).toBe(1);
    expect(stored?.[0].metadata_version).toBe(10);
  });
  it("AttributeAdded - batch with different attribute IDs inserts all records", async () => {
    const attr1: Attribute = {
      ...getMockAttribute(),
      id: generateId(),
      kind: attributeKind.certified,
    };

    const attr2: Attribute = {
      ...getMockAttribute(),
      id: generateId(),
      kind: attributeKind.declared,
    };

    const attr3: Attribute = {
      ...getMockAttribute(),
      id: generateId(),
      kind: attributeKind.verified,
    };

    const messages: AttributeEventEnvelope[] = [
      {
        sequence_num: 1,
        stream_id: attr1.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: attr1 as any },
        log_date: new Date(),
      },
      {
        sequence_num: 2,
        stream_id: attr2.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: attr2 as any },
        log_date: new Date(),
      },
      {
        sequence_num: 3,
        stream_id: attr3.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: attr3 as any },
        log_date: new Date(),
      },
    ];

    await handleAttributeMessageV1(messages, dbContext);

    const stored1 = await getAttributeFromDb(attr1.id, dbContext);
    const stored2 = await getAttributeFromDb(attr2.id, dbContext);
    const stored3 = await getAttributeFromDb(attr3.id, dbContext);
    const allStored = [stored1, stored2, stored3].flat();
    expect(allStored.length).toBe(messages.length);
    expect(stored1?.[0]?.id).toBe(attr1.id);
    expect(stored2?.[0]?.id).toBe(attr2.id);
    expect(stored3?.[0]?.id).toBe(attr3.id);
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
      data: { attribute: attr as any },
      log_date: new Date(),
    };
    await handleAttributeMessageV1([insertMessage], dbContext);

    const deleteMessage: AttributeEventEnvelope = {
      sequence_num: 2,
      stream_id: attr.id,
      version: 2,
      type: "MaintenanceAttributeDeleted",
      event_version: 1,
      data: { id: attr.id } as any,
      log_date: new Date(),
    };

    await handleAttributeMessageV1([deleteMessage], dbContext);
    const stored = await getAttributeFromDb(attr.id, dbContext);

    expect(stored?.length).toBe(0);
  });
});
