import { describe, expect, it, vi } from "vitest";
import { commandFailed, executeLinuxJob, MAX_REPAIR_ATTEMPTS } from "@/lib/linux-jobs";

describe("Linux execution", () => {
  it("runs only after files are saved and stops on the first failed command", async () => {
    const events: string[] = [];
    const log = await executeLinuxJob({ files: [], commands: ["install", "test", "start"] }, async () => { events.push("sync"); }, async (c) => {
      events.push(c); return c === "test" ? "[exit 1]" : "[exit 0]";
    });
    expect(events).toEqual(["sync", "install", "test"]);
    expect(commandFailed(log)).toBe(true);
  });
  it("never runs commands when syncing fails", async () => {
    const run = vi.fn();
    const log = await executeLinuxJob({ files: [], commands: ["start"] }, async () => { throw new Error("write failed"); }, run);
    expect(run).not.toHaveBeenCalled();
    expect(log).toContain("[error] write failed");
  });
  it("limits automatic repair to three attempts", () => {
    expect(MAX_REPAIR_ATTEMPTS).toBe(3);
  });
  it("distinguishes successful output from failed or killed processes", () => {
    expect(commandFailed("[exit 0]")).toBe(false);
    expect(commandFailed("[exit null]")).toBe(true);
    expect(commandFailed("[exit 127]")).toBe(true);
  });
});