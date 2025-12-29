import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { ISessionDriver } from "./contract.js";

const LOCK_STALE_MS = 30000; // Consider lock stale after 30 seconds
const LOCK_RETRY_MS = 50; // Retry interval
const LOCK_MAX_RETRIES = 100; // Max retries (5 seconds total)

/**
 * @added v0.2.12
 * File-based session driver with lock protection against race conditions
 */
export class SessionFileDriver implements ISessionDriver {
  _id: string | undefined;
  private locked = false;

  generateId() {
    return randomBytes(16).toString('hex');
  }

  id(): string {
    return this._id as string;
  }

  getSessionFile(id?: string) {
    return `${tmpdir()}/sess_${id || this._id}`;
  }

  private getLockFile(id?: string) {
    return `${this.getSessionFile(id)}.lock`;
  }

  private async acquireLock(id?: string): Promise<boolean> {
    const lockFile = this.getLockFile(id);

    for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
      try {
        // Try to create lock file exclusively
        await fs.writeFile(lockFile, Date.now().toString(), { flag: 'wx' });
        this.locked = true;
        return true;
      } catch (err: any) {
        if (err.code === 'EEXIST') {
          // Lock file exists, check if stale
          try {
            const content = await fs.readFile(lockFile, 'utf-8');
            const lockTime = parseInt(content, 10);
            if (Date.now() - lockTime > LOCK_STALE_MS) {
              // Stale lock, remove and retry
              await fs.unlink(lockFile).catch(() => {});
              continue;
            }
          } catch {
            // Can't read lock file, try to remove it
            await fs.unlink(lockFile).catch(() => {});
            continue;
          }
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_MS));
        } else {
          throw err;
        }
      }
    }
    return false;
  }

  private async releaseLock(id?: string): Promise<void> {
    if (!this.locked) return;
    const lockFile = this.getLockFile(id);
    try {
      await fs.unlink(lockFile);
    } catch {
      // Ignore errors when releasing lock
    }
    this.locked = false;
  }

  async open(id?: string): Promise<string> {
    id = id || this.generateId();
    const sessFile = this.getSessionFile(id);

    if (!await this.acquireLock(id)) {
      throw new Error('Failed to acquire session lock');
    }

    let exists = false;
    try {
      await fs.stat(sessFile);
      exists = true;
    } catch {
      // File doesn't exist
    }

    if (!exists) {
      await fs.writeFile(sessFile, '');
    }

    this._id = id;
    return id;
  }

  async write(data: any): Promise<void> {
    const sessFile = this.getSessionFile();
    await fs.writeFile(sessFile, data);
  }

  async read(): Promise<any> {
    const sessFile = this.getSessionFile();
    return (await fs.readFile(sessFile)).toString();
  }

  async close(): Promise<void> {
    await this.releaseLock();
  }

  async destroy(): Promise<void> {
    const sessFile = this.getSessionFile();
    try {
      await fs.unlink(sessFile);
    } catch {
      // Ignore if file doesn't exist
    }
    await this.releaseLock();
  }

  async reset(): Promise<void> {
    await this.releaseLock();
    await this.open();
  }
}