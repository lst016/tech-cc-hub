import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  normalizePluginConsentRecord,
  type PluginConsentRecord,
} from "./plugin-consent.js";

export type PluginConsentStoreWarning = "CONSENT_STORE_INVALID";

export type PluginConsentStoreSnapshot = {
  records: PluginConsentRecord[];
  warnings: PluginConsentStoreWarning[];
};

export type PluginConsentStoreOptions = {
  filePath: string;
};

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "ENOENT";
}

function cloneRecord(record: PluginConsentRecord): PluginConsentRecord {
  return {
    ...record,
    customGrants: [...record.customGrants],
  };
}

export class PluginConsentStore {
  readonly #filePath: string;
  #writes: Promise<void> = Promise.resolve();

  constructor(options: PluginConsentStoreOptions) {
    this.#filePath = options.filePath;
  }

  async list(): Promise<PluginConsentStoreSnapshot> {
    await this.#writes;
    return await this.#read();
  }

  async get(pluginId: string): Promise<PluginConsentRecord | null> {
    const snapshot = await this.list();
    const record = snapshot.records.find((item) => item.pluginId === pluginId);
    return record ? cloneRecord(record) : null;
  }

  set(record: PluginConsentRecord): Promise<void> {
    const normalized = normalizePluginConsentRecord(record);
    if (!normalized) return Promise.reject(new TypeError("Invalid plugin consent record"));

    return this.#enqueue(async () => {
      const snapshot = await this.#read();
      const records = snapshot.records.filter((item) => item.pluginId !== normalized.pluginId);
      records.push(normalized);
      await this.#write(records);
    });
  }

  delete(pluginId: string): Promise<boolean> {
    return this.#enqueue(async () => {
      const snapshot = await this.#read();
      const records = snapshot.records.filter((item) => item.pluginId !== pluginId);
      if (records.length === snapshot.records.length) return false;
      await this.#write(records);
      return true;
    });
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#writes.then(operation, operation);
    this.#writes = result.then(() => undefined, () => undefined);
    return result;
  }

  async #read(): Promise<PluginConsentStoreSnapshot> {
    let source: string;
    try {
      source = await readFile(this.#filePath, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) return { records: [], warnings: [] };
      return { records: [], warnings: ["CONSENT_STORE_INVALID"] };
    }

    try {
      const value = JSON.parse(source) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid store");
      const store = value as Record<string, unknown>;
      if (store.schemaVersion !== 1 || !Array.isArray(store.records)) throw new Error("invalid store");

      const records = store.records.map(normalizePluginConsentRecord);
      if (records.some((record) => !record)) throw new Error("invalid record");
      const normalized = records as PluginConsentRecord[];
      if (new Set(normalized.map((record) => record.pluginId)).size !== normalized.length) {
        throw new Error("duplicate plugin consent");
      }
      normalized.sort((left, right) => left.pluginId.localeCompare(right.pluginId, "en"));
      return { records: normalized.map(cloneRecord), warnings: [] };
    } catch {
      return { records: [], warnings: ["CONSENT_STORE_INVALID"] };
    }
  }

  async #write(records: readonly PluginConsentRecord[]): Promise<void> {
    const sorted = [...records]
      .map(cloneRecord)
      .sort((left, right) => left.pluginId.localeCompare(right.pluginId, "en"));
    const directory = dirname(this.#filePath);
    const tempPath = `${this.#filePath}.tmp-${process.pid}-${randomUUID()}`;
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(
        tempPath,
        `${JSON.stringify({ schemaVersion: 1, records: sorted }, null, 2)}\n`,
        { encoding: "utf8", flag: "wx", mode: 0o600 },
      );
      await rename(tempPath, this.#filePath);
    } finally {
      await rm(tempPath, { force: true }).catch(() => undefined);
    }
  }
}
