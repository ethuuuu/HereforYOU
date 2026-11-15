import { describe, expect, it } from "vitest";
import { fitWithin } from "./image";

describe("fitWithin", () => {
  it("shrinks a landscape phone photo so the long side is 1600px, keeping its shape", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
  });

  it("shrinks portrait photos by their height", () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it("never enlarges a photo that is already small enough", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 900)).toEqual({ width: 1600, height: 900 });
  });

  it("keeps very thin images at least 1px wide", () => {
    expect(fitWithin(10000, 2)).toEqual({ width: 1600, height: 1 });
  });

  it("supports a custom limit", () => {
    expect(fitWithin(2000, 1000, 1000)).toEqual({ width: 1000, height: 500 });
  });
});
