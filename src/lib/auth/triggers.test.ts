import { describe, expect, it } from "vitest";
import { isQStash, isVercelCron } from "./triggers";

describe("isVercelCron", () => {
  it("accepts the exact bearer secret only", () => {
    expect(isVercelCron("Bearer s3cret-value-123456", "s3cret-value-123456")).toBe(true);
    expect(isVercelCron("Bearer wrong", "s3cret-value-123456")).toBe(false);
    expect(isVercelCron(null, "s3cret-value-123456")).toBe(false);
    expect(isVercelCron("Bearer x", undefined)).toBe(false);
  });
});

describe("isQStash", () => {
  it("rejects missing or invalid signatures", async () => {
    expect(await isQStash(null, "{}", { current: "a", next: "b" })).toBe(false);
    expect(await isQStash("not-a-jwt", "{}", { current: "sig_current", next: "sig_next" })).toBe(false);
    expect(await isQStash("x", "{}", {})).toBe(false);
  });
});
