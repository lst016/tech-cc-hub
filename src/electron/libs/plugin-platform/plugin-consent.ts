import { createHash } from "node:crypto";

import {
  expandPluginCapabilityBundles,
  resolvePluginCapabilityGrant,
} from "../../../shared/plugin-platform/permissions.js";
import type {
  CanonicalPluginManifest,
  PluginAtomicCapability,
  PluginCapability,
  PluginGrantProfile,
} from "../../../shared/plugin-platform/types.js";

export type PluginConsentRecord = {
  schemaVersion: 1;
  pluginId: string;
  pluginVersion: string;
  capabilityFingerprint: string;
  profile: PluginGrantProfile;
  customGrants: PluginAtomicCapability[];
  grantedAt: number;
};

export type CreatePluginConsentRecordInput = {
  manifest: CanonicalPluginManifest;
  profile: PluginGrantProfile;
  customGrants?: readonly PluginCapability[];
  grantedAt: number;
};

export type CreatePluginConsentRecordResult =
  | {
      ok: true;
      record: PluginConsentRecord;
    }
  | {
      ok: false;
      code: "MISSING_REQUIRED_CAPABILITIES";
      missingRequiredCapabilities: PluginAtomicCapability[];
    };

export type ValidatePluginConsentRecordInput = {
  manifest: CanonicalPluginManifest;
  record: unknown;
};

export type ValidatePluginConsentRecordResult =
  | {
      ok: true;
      activation: {
        profile: PluginGrantProfile;
        customGrants?: PluginAtomicCapability[];
      };
    }
  | {
      ok: false;
      code:
        | "CONSENT_INVALID"
        | "PLUGIN_VERSION_CHANGED"
        | "CAPABILITIES_CHANGED";
    };

function uniqueSorted(capabilities: readonly PluginAtomicCapability[]): PluginAtomicCapability[] {
  return [...new Set(capabilities)].sort((left, right) => left.localeCompare(right, "en"));
}

export function fingerprintPluginCapabilities(
  manifest: CanonicalPluginManifest,
): string {
  const required = uniqueSorted(expandPluginCapabilityBundles(manifest.capabilities.required));
  const optional = uniqueSorted(expandPluginCapabilityBundles(manifest.capabilities.optional))
    .filter((capability) => !required.includes(capability));
  const source = JSON.stringify({ schemaVersion: 1, required, optional });
  return createHash("sha256").update(source).digest("hex");
}

export function createPluginConsentRecord(
  input: CreatePluginConsentRecordInput,
): CreatePluginConsentRecordResult {
  const grant = resolvePluginCapabilityGrant({
    requested: input.manifest.capabilities,
    profile: input.profile,
    customGrants: input.customGrants,
  });
  if (!grant.canActivate) {
    return {
      ok: false,
      code: "MISSING_REQUIRED_CAPABILITIES",
      missingRequiredCapabilities: [...grant.missingRequiredCapabilities],
    };
  }

  return {
    ok: true,
    record: {
      schemaVersion: 1,
      pluginId: input.manifest.id,
      pluginVersion: input.manifest.version,
      capabilityFingerprint: fingerprintPluginCapabilities(input.manifest),
      profile: input.profile,
      customGrants: input.profile === "custom"
        ? [...grant.effectiveCapabilities]
        : [],
      grantedAt: input.grantedAt,
    },
  };
}

function parseConsentRecord(value: unknown): PluginConsentRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !== 1
    || typeof record.pluginId !== "string"
    || typeof record.pluginVersion !== "string"
    || typeof record.capabilityFingerprint !== "string"
    || !/^[a-f0-9]{64}$/.test(record.capabilityFingerprint)
    || !["standard", "full-trust", "custom"].includes(String(record.profile))
    || !Array.isArray(record.customGrants)
    || !record.customGrants.every((capability) => typeof capability === "string" && capability.length > 0)
    || typeof record.grantedAt !== "number"
    || !Number.isFinite(record.grantedAt)
    || record.grantedAt < 0
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    pluginId: record.pluginId,
    pluginVersion: record.pluginVersion,
    capabilityFingerprint: record.capabilityFingerprint,
    profile: record.profile as PluginGrantProfile,
    customGrants: [...record.customGrants] as PluginAtomicCapability[],
    grantedAt: record.grantedAt,
  };
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function validatePluginConsentRecord(
  input: ValidatePluginConsentRecordInput,
): ValidatePluginConsentRecordResult {
  const record = parseConsentRecord(input.record);
  if (!record || record.pluginId !== input.manifest.id) {
    return { ok: false, code: "CONSENT_INVALID" };
  }
  if (record.pluginVersion !== input.manifest.version) {
    return { ok: false, code: "PLUGIN_VERSION_CHANGED" };
  }
  if (record.capabilityFingerprint !== fingerprintPluginCapabilities(input.manifest)) {
    return { ok: false, code: "CAPABILITIES_CHANGED" };
  }

  const grant = resolvePluginCapabilityGrant({
    requested: input.manifest.capabilities,
    profile: record.profile,
    customGrants: record.profile === "custom" ? record.customGrants : undefined,
  });
  if (
    !grant.canActivate
    || (record.profile === "custom" && !arraysEqual(
      grant.effectiveCapabilities,
      record.customGrants,
    ))
    || (record.profile !== "custom" && record.customGrants.length > 0)
  ) {
    return { ok: false, code: "CONSENT_INVALID" };
  }

  return {
    ok: true,
    activation: record.profile === "custom"
      ? { profile: record.profile, customGrants: [...record.customGrants] }
      : { profile: record.profile },
  };
}
