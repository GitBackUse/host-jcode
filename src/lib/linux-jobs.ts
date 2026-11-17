import type { ProjectFile } from "./gemini";

export const MAX_REPAIR_ATTEMPTS = 3;
export function commandFailed(log: string) {
  return /\[exit (?:[1-9]\d*|null)\]|\[error\]/.test(log);
}

export async function executeLinuxJob(
  job: { files: ProjectFile[]; commands: string[] },
  sync: (files: ProjectFile[]) => Promise<void>,
  run: (command: string) => Promise<string>,
) {
  try {
    await sync(job.files);
    let log = "";
    for (const command of job.commands) {
      const output = await run(command);
      log += `$ ${command}\n${output}`;
      if (commandFailed(output)) break;
    }
    return log;
  } catch (error) {
    return `[error] ${error instanceof Error ? error.message : String(error)}\n[exit 1]\n`;
  }
}