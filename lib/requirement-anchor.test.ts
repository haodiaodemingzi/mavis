import { describe, it, expect } from "vitest";
import {
  parseRequirements,
  matchRequirements,
  formatAnchor,
  type RequirementBlock,
} from "./requirement-anchor.js";

const SAMPLE_SPEC = `# Requirements Spec

### Requirement: User-Authentication
The system shall support OAuth2-based login for end users.
Users can authenticate with Google, GitHub, or email/password.

**Constraints:**
- Must respond within 200ms
- Must support 2FA

**Scenarios:**
- WHEN/THEN: User logs in with Google -> redirected to dashboard

---

### Requirement: Payment-Processing
The payment system shall process credit card transactions via Stripe.
All transactions must be idempotent.

**Scenarios:**
- WHEN/THEN: User submits payment -> charge is created

---

### Requirement: Data-Export
Users can export their data in CSV and JSON formats.
Export must complete within 30 seconds for datasets up to 1GB.

---
`;

const MALFORMED_SPEC = `# Some document

This has no proper requirement headings.

## Random section
Just some text here.
`;

describe("requirement-anchor", () => {
  describe("parseRequirements", () => {
    it("lists all requirement IDs from a spec", () => {
      const blocks = parseRequirements(SAMPLE_SPEC);
      expect(blocks).toHaveLength(3);
      expect(blocks.map((b) => b.id)).toEqual([
        "User-Authentication",
        "Payment-Processing",
        "Data-Export",
      ]);
    });

    it("extracts full body text for each requirement", () => {
      const blocks = parseRequirements(SAMPLE_SPEC);
      const auth = blocks.find((b) => b.id === "User-Authentication")!;
      expect(auth.body).toContain("OAuth2-based login");
      expect(auth.body).toContain("Must respond within 200ms");
      expect(auth.body).toContain("WHEN/THEN");
    });

    it("includes fullText with heading and body", () => {
      const blocks = parseRequirements(SAMPLE_SPEC);
      const payment = blocks.find((b) => b.id === "Payment-Processing")!;
      expect(payment.fullText).toContain("### Requirement: Payment-Processing");
      expect(payment.fullText).toContain("idempotent");
    });

    it("handles malformed spec (no requirement headings)", () => {
      const blocks = parseRequirements(MALFORMED_SPEC);
      expect(blocks).toHaveLength(0);
    });

    it("handles empty content", () => {
      const blocks = parseRequirements("");
      expect(blocks).toHaveLength(0);
    });

    it("handles spec with single requirement", () => {
      const singleSpec = `### Requirement: Only-One
Just one requirement here.
`;
      const blocks = parseRequirements(singleSpec);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].id).toBe("Only-One");
      expect(blocks[0].body).toContain("Just one requirement here.");
    });
  });

  describe("matchRequirements (fuzzy match)", () => {
    it("matches task description to relevant requirement", () => {
      const blocks = parseRequirements(SAMPLE_SPEC);
      const matches = matchRequirements("implement OAuth2 login for users", blocks);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].id).toBe("User-Authentication");
    });

    it("matches payment-related tasks", () => {
      const blocks = parseRequirements(SAMPLE_SPEC);
      const matches = matchRequirements("process credit card payment with Stripe", blocks);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].id).toBe("Payment-Processing");
    });

    it("matches data export tasks", () => {
      const blocks = parseRequirements(SAMPLE_SPEC);
      const matches = matchRequirements("export user data in CSV format", blocks);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some((m) => m.id === "Data-Export")).toBe(true);
    });

    it("returns empty array for completely unrelated task", () => {
      const blocks = parseRequirements(SAMPLE_SPEC);
      const matches = matchRequirements("xxxxxxxxx zzzzzzz qqqqqq", blocks);
      expect(matches).toHaveLength(0);
    });

    it("handles empty requirements list", () => {
      const matches = matchRequirements("anything", []);
      expect(matches).toHaveLength(0);
    });
  });

  describe("formatAnchor", () => {
    it("formats matched requirements with header and acceptance criteria", () => {
      const blocks = parseRequirements(SAMPLE_SPEC);
      const matched = [blocks[0]]; // User-Authentication
      const output = formatAnchor(matched);

      expect(output).toContain("## Requirement You Must Satisfy");
      expect(output).toContain("VERBATIM");
      expect(output).toContain("### Requirement: User-Authentication");
      expect(output).toContain("## Acceptance Criteria");
      expect(output).toContain("PASSES if and only if");
    });

    it("formats multiple matched requirements", () => {
      const blocks = parseRequirements(SAMPLE_SPEC);
      const output = formatAnchor(blocks.slice(0, 2));
      expect(output).toContain("User-Authentication");
      expect(output).toContain("Payment-Processing");
    });

    it("returns no-match message for empty matches", () => {
      const output = formatAnchor([]);
      expect(output).toContain("No Matching Requirements Found");
      expect(output).toContain("No requirements matched");
    });
  });

  describe("edge cases", () => {
    it("handles requirement ID with special characters", () => {
      const spec = `### Requirement: Auth_v2.0-Beta
A requirement with special chars in ID.
`;
      const blocks = parseRequirements(spec);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].id).toBe("Auth_v2.0-Beta");
    });

    it("handles requirements with no body content", () => {
      const spec = `### Requirement: Empty-Body
### Requirement: Has-Body
This one has content.
`;
      const blocks = parseRequirements(spec);
      // Empty-Body gets closed when Has-Body heading appears
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      const hasBody = blocks.find((b) => b.id === "Has-Body");
      expect(hasBody).toBeDefined();
      expect(hasBody!.body).toContain("This one has content.");
    });
  });
});
