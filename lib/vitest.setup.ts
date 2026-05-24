import { vi } from "vitest";

// Source modules invoke cli() at the top level on import.
// The CLI reads process.argv and calls process.exit(1) for unknown commands.
// We stub process.exit as a no-op so vitest can import these modules safely.
const originalExit = process.exit;
process.exit = vi.fn() as any;
