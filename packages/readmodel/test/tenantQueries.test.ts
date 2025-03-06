/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { describe, it, expect } from "vitest";

describe("Tenant Queries", () => {
  describe("Upsert Tenant", () => {
    it("should add a complete (*all* fields) tenant", () => {
      expect(1).toEqual(0);
    });
    it("should add an incomplete (*only* mandatory fields) tenant", () => {
      expect(1).toEqual(0);
    });
    it("should update a complete (*all* fields) tenant", () => {
      expect(1).toEqual(0);
    });
  });
  describe("Get a Tenant", () => {
    it("should get a tenant from a tenantId", () => {
      expect(1).toEqual(0);
    });
    it("should *not* get a tenant from a tenantId", () => {
      expect(1).toEqual(0);
    });
  });
  describe("Get all Tenants", () => {
    it("should get all tenants", () => {
      expect(1).toEqual(0);
    });
    it("should *not* get any tenants", () => {
      expect(1).toEqual(0);
    });
  });
  describe("Delete a Tenant", () => {
    it("should delete a tenant from a tenantId", () => {
      expect(1).toEqual(0);
    });
  });
});
