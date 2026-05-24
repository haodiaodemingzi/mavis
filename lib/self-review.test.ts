import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
  checkPlaceholders,
  checkConsistency,
  checkScope,
  checkAmbiguity,
  runReview,
} from "./self-review.js";

const TEST_DIR = join(process.cwd(), ".mavis-test-sr");

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

function writeTestFile(filename: string, content: string): string {
  const filePath = join(TEST_DIR, filename);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("self-review", () => {
  describe("checkPlaceholders", () => {
    it("detects TBD", () => {
      const lines = ["The authentication mechanism is TBD"];
      const issues = checkPlaceholders(lines.join("\n"), lines);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].check).toBe("placeholder-scan");
      expect(issues[0].severity).toBe("HIGH");
      expect(issues[0].suggestion).toContain("TBD");
    });

    it("detects TODO", () => {
      const lines = ["TODO: define the API contract"];
      const issues = checkPlaceholders(lines.join("\n"), lines);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].suggestion).toContain("TODO");
    });

    it("detects FIXME", () => {
      const lines = ["FIXME this section is incomplete"];
      const issues = checkPlaceholders(lines.join("\n"), lines);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].suggestion).toContain("FIXME");
    });

    it("detects 'to be determined'", () => {
      const lines = ["The deployment strategy is to be determined later"];
      const issues = checkPlaceholders(lines.join("\n"), lines);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].suggestion).toContain("to be determined");
    });

    it("detects 'maybe' and 'probably'", () => {
      const lines = ["This will probably work", "Maybe we should use Redis"];
      const issues = checkPlaceholders(lines.join("\n"), lines);
      expect(issues.length).toBe(2);
    });

    it("returns empty array for clean content", () => {
      const lines = [
        "# Authentication Spec",
        "",
        "The system shall use OAuth2 for authentication.",
        "Response time must be under 200ms.",
      ];
      const issues = checkPlaceholders(lines.join("\n"), lines);
      expect(issues).toHaveLength(0);
    });
  });

  describe("checkConsistency", () => {
    it("detects 'must' vs 'must not' contradiction in same section", () => {
      const lines = [
        "## Authentication",
        "The system must store user passwords in plaintext",
        "The system must not store user passwords in plaintext",
      ];
      const issues = checkConsistency(lines.join("\n"), lines);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].check).toBe("consistency");
      expect(issues[0].severity).toBe("HIGH");
    });

    it("returns no issues for non-contradicting statements", () => {
      const lines = [
        "## Authentication",
        "The login page must validate user credentials",
        "The error handler must not expose stack traces to browsers",
      ];
      const issues = checkConsistency(lines.join("\n"), lines);
      expect(issues).toHaveLength(0);
    });
  });

  describe("checkScope", () => {
    it("flags document with too many unrelated requirements", () => {
      const lines = [
        "### Requirement: User-Auth",
        "User authentication features",
        "### Requirement: Payment-Gateway",
        "Payment processing logic",
        "### Requirement: Email-Notifications",
        "Email sending system",
        "### Requirement: Analytics-Dashboard",
        "Data visualization panel",
      ];
      const issues = checkScope(lines.join("\n"), lines);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].check).toBe("scope");
      expect(issues[0].severity).toBe("MEDIUM");
    });

    it("passes when requirements are 3 or fewer", () => {
      const lines = [
        "### Requirement: User-Auth",
        "Login",
        "### Requirement: User-Registration",
        "Registration",
      ];
      const issues = checkScope(lines.join("\n"), lines);
      expect(issues).toHaveLength(0);
    });

    it("passes when shared dependencies exist", () => {
      const lines = [
        "### Requirement: User-Auth",
        "Login depends_on User-DB",
        "### Requirement: User-Profile",
        "Profile settings",
        "### Requirement: User-Preferences",
        "User preferences",
        "### Requirement: User-Notifications",
        "Notifications",
      ];
      const content = lines.join("\n");
      const issues = checkScope(content, lines);
      expect(issues).toHaveLength(0);
    });
  });

  describe("checkAmbiguity", () => {
    it("detects 'some' without a number", () => {
      const lines = ["The system handles some requests in parallel"];
      const issues = checkAmbiguity(lines.join("\n"), lines);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].check).toBe("ambiguity");
      expect(issues[0].suggestion).toContain("some");
    });

    it("detects 'fast' without a number", () => {
      const lines = ["The API must be fast"];
      const issues = checkAmbiguity(lines.join("\n"), lines);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].suggestion).toContain("fast");
    });

    it("detects 'many' without a number", () => {
      const lines = ["Supports many concurrent users"];
      const issues = checkAmbiguity(lines.join("\n"), lines);
      expect(issues.length).toBeGreaterThan(0);
    });

    it("passes when ambiguous word is accompanied by a number", () => {
      const lines = ["The system handles some 500 requests per second"];
      const issues = checkAmbiguity(lines.join("\n"), lines);
      expect(issues).toHaveLength(0);
    });

    it("skips headings", () => {
      const lines = ["# Some overview section"];
      const issues = checkAmbiguity(lines.join("\n"), lines);
      expect(issues).toHaveLength(0);
    });
  });

  describe("runReview (combined)", () => {
    it("passes a clean document", () => {
      const content = [
        "# Authentication Specification",
        "",
        "## Overview",
        "The system shall authenticate users via OAuth2.",
        "Response time must be under 200ms.",
        "",
        "### Requirement: OAuth2-Login",
        "Implements OAuth2 authorization code flow.",
      ].join("\n");

      const filePath = writeTestFile("clean-spec.md", content);
      const result = runReview(filePath);
      expect(result.pass).toBe(true);
      expect(result.issues.filter((i) => i.severity === "HIGH")).toHaveLength(0);
    });

    it("fails a document with placeholders", () => {
      const content = [
        "# Spec",
        "",
        "The deployment strategy is TBD.",
        "Performance target: TODO",
      ].join("\n");

      const filePath = writeTestFile("bad-spec.md", content);
      const result = runReview(filePath);
      expect(result.pass).toBe(false);
      expect(result.issues.some((i) => i.check === "placeholder-scan")).toBe(true);
    });

    it("reports multiple issue types from one document", () => {
      const content = [
        "# Spec",
        "",
        "## Section A",
        "The system must store data in memory",
        "The system must not store data in memory",
        "",
        "The cache layer is TBD.",
        "Response should be fast",
      ].join("\n");

      const filePath = writeTestFile("multi-issue.md", content);
      const result = runReview(filePath);
      expect(result.pass).toBe(false);
      const checks = new Set(result.issues.map((i) => i.check));
      expect(checks.has("placeholder-scan")).toBe(true);
      expect(checks.has("ambiguity")).toBe(true);
    });

    it("returns proper JSON structure with severity", () => {
      const content = "The system is TBD and must be fast\n";
      const filePath = writeTestFile("structure.md", content);
      const result = runReview(filePath);

      expect(result).toHaveProperty("pass");
      expect(result).toHaveProperty("issues");
      expect(Array.isArray(result.issues)).toBe(true);
      for (const issue of result.issues) {
        expect(issue).toHaveProperty("check");
        expect(issue).toHaveProperty("severity");
        expect(issue).toHaveProperty("location");
        expect(issue).toHaveProperty("suggestion");
        expect(["HIGH", "MEDIUM"]).toContain(issue.severity);
      }
    });

    it("throws for non-existent file", () => {
      expect(() => runReview("/nonexistent/file.md")).toThrow("File not found");
    });
  });
});
