import { describe, it, expect } from "vitest";
import { toCsv } from "./csvExport";

describe("toCsv", () => {
  const columns = [
    { key: "name", label: "Name" },
    { key: "cost", label: "Cost" },
  ];

  it("generates CSV with header and rows", () => {
    const rows = [
      { name: "EC2", cost: "500" },
      { name: "S3", cost: "120" },
    ];
    expect(toCsv(rows, columns)).toBe("Name,Cost\nEC2,500\nS3,120");
  });

  it("handles empty rows", () => {
    expect(toCsv([], columns)).toBe("Name,Cost");
  });

  it("escapes commas in values", () => {
    const rows = [{ name: "A, B", cost: "100" }];
    expect(toCsv(rows, columns)).toBe('Name,Cost\n"A, B",100');
  });

  it("escapes double quotes in values", () => {
    const rows = [{ name: 'Say "hello"', cost: "0" }];
    expect(toCsv(rows, columns)).toBe('Name,Cost\n"Say ""hello""",0');
  });

  it("handles missing keys with empty string", () => {
    const rows = [{ name: "EC2" }];
    expect(toCsv(rows, columns)).toBe("Name,Cost\nEC2,");
  });
});
