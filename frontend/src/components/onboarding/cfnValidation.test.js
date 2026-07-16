import { describe, it, expect } from "vitest";
import { validateCfnField } from "./cfnValidation";

describe("validateCfnField", () => {
  describe("bucket", () => {
    it("accepts blank", () => {
      expect(validateCfnField("bucket", "")).toBeNull();
      expect(validateCfnField("bucket", null)).toBeNull();
      expect(validateCfnField("bucket", undefined)).toBeNull();
    });

    it("accepts a valid bucket name", () => {
      expect(validateCfnField("bucket", "numio-cur-prod")).toBeNull();
      expect(validateCfnField("bucket", "acme.cur.exports")).toBeNull();
      expect(validateCfnField("bucket", "ab1")).toBeNull();
    });

    it("rejects leading whitespace", () => {
      expect(validateCfnField("bucket", " numio-cost-info")).toMatch(/lowercase/);
    });

    it("rejects uppercase letters", () => {
      expect(validateCfnField("bucket", "MyBucket")).toMatch(/lowercase/);
    });

    it("rejects names ending with a hyphen", () => {
      expect(validateCfnField("bucket", "my-bucket-")).toMatch(/lowercase/);
    });

    it("rejects names shorter than 3 characters", () => {
      expect(validateCfnField("bucket", "ab")).toMatch(/lowercase/);
    });
  });

  describe("prefix", () => {
    it("accepts blank", () => {
      expect(validateCfnField("prefix", "")).toBeNull();
    });

    it("accepts a valid prefix", () => {
      expect(validateCfnField("prefix", "daily/MyCostExport/data")).toBeNull();
      expect(validateCfnField("prefix", "cur")).toBeNull();
    });

    it("rejects spaces", () => {
      expect(validateCfnField("prefix", "my prefix")).toMatch(/letters, numbers/);
    });

    it("rejects unsupported characters", () => {
      expect(validateCfnField("prefix", "cur:reports")).toMatch(/letters, numbers/);
    });
  });

  describe("report", () => {
    it("accepts blank", () => {
      expect(validateCfnField("report", "")).toBeNull();
    });

    it("accepts a valid report name", () => {
      expect(validateCfnField("report", "MyCostExport")).toBeNull();
      expect(validateCfnField("report", "numio-cur-prod")).toBeNull();
      expect(validateCfnField("report", "report_42")).toBeNull();
    });

    it("rejects dots", () => {
      expect(validateCfnField("report", "my.report")).toMatch(/letters, numbers/);
    });

    it("rejects spaces", () => {
      expect(validateCfnField("report", "my report")).toMatch(/letters, numbers/);
    });
  });

  it("returns null for an unknown kind", () => {
    expect(validateCfnField("unknown", "anything")).toBeNull();
  });
});
