import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {}
  return { requireUser: vi.fn(), UnauthorizedError };
});
vi.mock("@/lib/data/rateLimits", () => ({ enforceRateLimit: vi.fn(), clientIp: () => "203.0.113.7" }));
vi.mock("@/lib/ai/gemini", () => {
  class AIError extends Error {}
  return { generateSpeech: vi.fn(), AIError };
});

const { requireUser, UnauthorizedError } = await import("@/lib/auth/session");
const { generateSpeech, AIError } = await import("@/lib/ai/gemini");
const { enforceRateLimit } = await import("@/lib/data/rateLimits");
const { HttpError } = await import("@/lib/http");
const { POST } = await import("./route");

const req = (body: unknown) =>
  new Request("http://test/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

afterEach(() => vi.clearAllMocks());

describe("POST /api/tts", () => {
  it("returns Gemini speech as WAV for a signed-in user", async () => {
    vi.mocked(requireUser).mockResolvedValue({ uid: "u1" });
    vi.mocked(generateSpeech).mockResolvedValue(Buffer.from("RIFFfake"));
    const res = await POST(req({ text: "Metformin at 8:00 AM" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("RIFFfake");
    expect(generateSpeech).toHaveBeenCalledWith("Metformin at 8:00 AM");
  });

  it("rejects signed-out callers (401) without calling Gemini", async () => {
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
    const res = await POST(req({ text: "Hello" }));
    expect(res.status).toBe(401);
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it("rejects empty or over-long text (400)", async () => {
    vi.mocked(requireUser).mockResolvedValue({ uid: "u1" });
    expect((await POST(req({ text: "  " }))).status).toBe(400);
    expect((await POST(req({ text: "a".repeat(1501) }))).status).toBe(400);
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it("rate-limits each account (429) before calling Gemini", async () => {
    vi.mocked(requireUser).mockResolvedValue({ uid: "u1" });
    vi.mocked(enforceRateLimit).mockRejectedValueOnce(new HttpError(429, "slow down"));
    const res = await POST(req({ text: "Hello" }));
    expect(res.status).toBe(429);
    expect(enforceRateLimit).toHaveBeenCalledWith("tts:u1", 60);
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it("maps a Gemini failure to 502 so the browser can fall back", async () => {
    vi.mocked(requireUser).mockResolvedValue({ uid: "u1" });
    vi.mocked(generateSpeech).mockRejectedValue(new AIError("down"));
    const res = await POST(req({ text: "Hello" }));
    expect(res.status).toBe(502);
  });
});
