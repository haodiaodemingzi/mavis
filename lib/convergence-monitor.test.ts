import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync } from "fs";
import { join } from "path";
import {
  loadTracker,
  saveTracker,
  trackAttempt,
  shouldEscalate,
  type FixTracker,
} from "./convergence-monitor.js";

// The module uses join(process.cwd(), ".mavis", "fix-tracker.json") as a constant
// captured at load time. We clean the actual .mavis/fix-tracker.json between tests.
const TRACKER_FILE = join(process.cwd(), ".mavis", "fix-tracker.json");

beforeEach(() => {
  // Remove any existing tracker file so each test starts fresh
  if (existsSync(TRACKER_FILE)) {
    rmSync(TRACKER_FILE, { force: true });
  }
});

afterEach(() => {
  if (existsSync(TRACKER_FILE)) {
    rmSync(TRACKER_FILE, { force: true });
  }
});

describe("convergence-monitor", () => {
  describe("fresh tracker", () => {
    it("loads empty tracker when no file exists", () => {
      const tracker = loadTracker();
      expect(tracker.requirements).toEqual({});
      expect(tracker.cycles).toBe(0);
      expect(tracker.trend).toBe("unknown");
    });
  });

  describe("trackAttempt", () => {
    it("tracks a pass result", () => {
      const tracker = trackAttempt("REQ-001", "pass", "code-agent");
      expect(tracker.requirements["REQ-001"]).toBeDefined();
      expect(tracker.requirements["REQ-001"].attempts).toBe(1);
      expect(tracker.requirements["REQ-001"].history).toEqual(["pass"]);
      expect(tracker.requirements["REQ-001"].lastAgent).toBe("code-agent");
    });

    it("tracks a fail result", () => {
      const tracker = trackAttempt("REQ-001", "fail", "test-agent");
      expect(tracker.requirements["REQ-001"].attempts).toBe(1);
      expect(tracker.requirements["REQ-001"].history).toEqual(["fail"]);
      expect(tracker.requirements["REQ-001"].lastAgent).toBe("test-agent");
    });

    it("accumulates multiple attempts for same requirement", () => {
      trackAttempt("REQ-001", "fail", "agent-1");
      trackAttempt("REQ-001", "fail", "agent-2");
      const tracker = trackAttempt("REQ-001", "pass", "agent-3");

      expect(tracker.requirements["REQ-001"].attempts).toBe(3);
      expect(tracker.requirements["REQ-001"].history).toEqual(["fail", "fail", "pass"]);
      expect(tracker.requirements["REQ-001"].lastAgent).toBe("agent-3");
    });

    it("tracks multiple requirements independently", () => {
      trackAttempt("REQ-001", "pass", "agent-a");
      trackAttempt("REQ-002", "fail", "agent-b");

      const tracker = loadTracker();
      expect(tracker.requirements["REQ-001"].history).toEqual(["pass"]);
      expect(tracker.requirements["REQ-002"].history).toEqual(["fail"]);
    });

    it("increments global cycles count", () => {
      trackAttempt("REQ-001", "pass", "agent");
      trackAttempt("REQ-002", "fail", "agent");
      const tracker = trackAttempt("REQ-001", "pass", "agent");
      expect(tracker.cycles).toBe(3);
    });
  });

  describe("convergence detection", () => {
    it("detects converging trend (failures decreasing)", () => {
      trackAttempt("REQ-001", "fail", "agent");
      const tracker = trackAttempt("REQ-001", "pass", "agent");
      expect(tracker.trend).toBe("converging");
    });

    it("detects diverging trend (failures increasing)", () => {
      trackAttempt("REQ-001", "pass", "agent");
      const tracker = trackAttempt("REQ-001", "fail", "agent");
      expect(tracker.trend).toBe("diverging");
    });
  });

  describe("oscillation detection", () => {
    it("detects oscillation pattern (alternating pass/fail over 4 entries)", () => {
      trackAttempt("REQ-001", "pass", "agent");
      trackAttempt("REQ-001", "fail", "agent");
      trackAttempt("REQ-001", "pass", "agent");
      const tracker = trackAttempt("REQ-001", "fail", "agent");
      expect(tracker.trend).toBe("oscillating");
    });

    it("does not detect oscillation with too few entries", () => {
      trackAttempt("REQ-001", "pass", "agent");
      const tracker = trackAttempt("REQ-001", "fail", "agent");
      // Only 2 entries, need at least 4 for oscillation
      expect(tracker.trend).not.toBe("oscillating");
    });

    it("does not detect oscillation when pattern is not alternating", () => {
      trackAttempt("REQ-001", "fail", "agent");
      trackAttempt("REQ-001", "fail", "agent");
      trackAttempt("REQ-001", "pass", "agent");
      const tracker = trackAttempt("REQ-001", "pass", "agent");
      expect(tracker.trend).not.toBe("oscillating");
    });
  });

  describe("shouldEscalate", () => {
    it("recommends escalation when attempts >= 3 (default max)", () => {
      trackAttempt("REQ-001", "fail", "agent");
      trackAttempt("REQ-001", "fail", "agent");
      trackAttempt("REQ-001", "fail", "agent");

      const check = shouldEscalate("REQ-001");
      expect(check.shouldEscalate).toBe(true);
      expect(check.attempts).toBe(3);
      expect(check.reason).toContain("max attempts");
    });

    it("recommends escalation when oscillating", () => {
      trackAttempt("REQ-001", "pass", "agent");
      trackAttempt("REQ-001", "fail", "agent");
      trackAttempt("REQ-001", "pass", "agent");
      trackAttempt("REQ-001", "fail", "agent");

      const check = shouldEscalate("REQ-001");
      expect(check.shouldEscalate).toBe(true);
      expect(check.pattern).toBe("oscillating");
      expect(check.reason).toContain("oscillating");
    });

    it("does not recommend escalation below threshold", () => {
      trackAttempt("REQ-001", "fail", "agent");

      const check = shouldEscalate("REQ-001");
      expect(check.shouldEscalate).toBe(false);
      expect(check.attempts).toBe(1);
    });

    it("returns safe default for untracked requirement", () => {
      const check = shouldEscalate("REQ-NONEXISTENT");
      expect(check.shouldEscalate).toBe(false);
      expect(check.attempts).toBe(0);
      expect(check.pattern).toBe("unknown");
    });

    it("respects custom maxAttempts parameter", () => {
      trackAttempt("REQ-001", "fail", "agent");
      trackAttempt("REQ-001", "fail", "agent");

      // Default max is 3 — should not escalate at 2
      const check1 = shouldEscalate("REQ-001");
      expect(check1.shouldEscalate).toBe(false);

      // Custom max of 2 — should escalate at 2
      const check2 = shouldEscalate("REQ-001", 2);
      expect(check2.shouldEscalate).toBe(true);
    });
  });

  describe("save/load round-trip", () => {
    it("persists tracker state across saves", () => {
      trackAttempt("REQ-001", "fail", "agent-x");
      trackAttempt("REQ-002", "pass", "agent-y");

      const loaded = loadTracker();
      expect(loaded.requirements["REQ-001"].history).toEqual(["fail"]);
      expect(loaded.requirements["REQ-002"].history).toEqual(["pass"]);
      expect(loaded.cycles).toBe(2);
    });
  });
});
