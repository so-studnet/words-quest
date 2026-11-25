import { describe, expect, it } from "vitest";
import { googleImagesUrl } from "./image-search";

describe("googleImagesUrl", () => {
  it("opens Google Images for the query", () => {
    const u = new URL(googleImagesUrl("serendipity"));
    expect(u.origin + u.pathname).toBe("https://www.google.com/search");
    expect(u.searchParams.get("q")).toBe("serendipity");
    expect(u.searchParams.get("tbm")).toBe("isch");
    expect(u.searchParams.get("udm")).toBe("2");
  });
  it("encodes spaces and symbols", () => {
    const url = googleImagesUrl("rock & roll's #1?");
    expect(new URL(url).searchParams.get("q")).toBe("rock & roll's #1?");
    expect(url).not.toContain(" ");
    expect(url).toContain("q=rock+%26+roll%27s+%231%3F");
  });
});
