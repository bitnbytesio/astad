import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { ISessionDriver } from "./contract.js";

/**
 * @added v0.2.12
 */
export class SessionFileDriver implements ISessionDriver {
  _id: string | undefined;

  generateId() {
    return randomBytes(16).toString('hex');
  }

  async id(): Promise<string> {
    return this._id as string;
  }

  async open(id?: string): Promise<string> {
    id = id || this.generateId();
    const sessFile = `${tmpdir()}/sess_${id}`;
    let exists = false;
    try {
      await fs.stat(sessFile)
      exists = true;
    } catch { }
    if (!exists) {
      await fs.writeFile(sessFile, '');
    }
    this._id = id;
    return id;
  }

  async write(data: any): Promise<void> {
    const sessFile = `${tmpdir()}/sess_${this._id}`;
    await fs.writeFile(sessFile, data);
  }

  async read(): Promise<any> {
    const sessFile = `${tmpdir()}/sess_${this._id}`;
    return (await fs.readFile(sessFile)).toString();
  }

  async close(): Promise<void> {

  }

  async destroy(): Promise<void> {
    const sessFile = `${tmpdir()}/sess_${this._id}`;
    await fs.unlink(sessFile);
  }

  async reset(): Promise<void> {
    await this.open();
  }
}