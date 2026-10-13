import { resolveUrl } from "../renderer/src/features/browser/components/BrowserView";

describe("BrowserView resolveUrl", () => {
  it("resolves domain-like input to https", () => {
    expect(resolveUrl("google.com", "duckduckgo")).toBe("https://google.com");
    expect(resolveUrl("sub.domain.org/path", "duckduckgo")).toBe("https://sub.domain.org/path");
    expect(resolveUrl("example.com:8080/test", "duckduckgo")).toBe("https://example.com:8080/test");
  });

  it("preserves explicit http, https, and file protocols", () => {
    expect(resolveUrl("http://example.com", "duckduckgo")).toBe("http://example.com");
    expect(resolveUrl("https://example.com/foo?bar=1", "duckduckgo")).toBe("https://example.com/foo?bar=1");
    expect(resolveUrl("file:///home/user/test.html", "duckduckgo")).toBe("file:///home/user/test.html");
  });

  it("preserves localhost with and without port", () => {
    expect(resolveUrl("localhost:3000", "duckduckgo")).toBe("http://localhost:3000");
    expect(resolveUrl("localhost", "duckduckgo")).toBe("http://localhost");
    expect(resolveUrl("http://localhost:8080", "duckduckgo")).toBe("http://localhost:8080");
  });

  it("converts search queries to target search engine URLs", () => {
    expect(resolveUrl("hello world", "duckduckgo")).toBe("https://duckduckgo.com/?q=hello%20world");
    expect(resolveUrl("react hooks tutorial", "google")).toBe("https://www.google.com/search?q=react%20hooks%20tutorial");
    expect(resolveUrl("electron builder", "bing")).toBe("https://www.bing.com/search?q=electron%20builder");
  });

  it("evaluates potential ReDoS patterns in linear time without freeze", () => {
    const maliciousInput = "a.co" + "/ ".repeat(50) + "!";
    const start = Date.now();
    const result = resolveUrl(maliciousInput, "duckduckgo");
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(50);
    expect(result).toContain("https://duckduckgo.com/?q=");
  });
});
