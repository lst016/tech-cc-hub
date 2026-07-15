import test from "node:test";
import assert from "node:assert/strict";

import { useAppStore, type SessionView } from "../../src/ui/store/useAppStore.js";
import type { ApiConfigProfile } from "../../src/ui/types.js";

const profile: ApiConfigProfile = {
  id: "gateway",
  name: "Gateway",
  apiKey: "sk-test",
  baseURL: "https://gateway.example.com/v1",
  model: "excluded-model",
  expertModel: "undeclared-role-model",
  models: [
    { name: "legacy-model" },
    { name: "managed-model", catalogStatus: "managed" },
    { name: "discovered-model", catalogStatus: "discovered" },
    { name: "excluded-model", catalogStatus: "excluded" },
  ],
  enabled: true,
  apiType: "anthropic",
};

function session(id: string, model?: string): SessionView {
  return {
    id,
    title: id,
    status: "idle",
    model,
    messages: [],
    permissionRequests: [],
    hydrated: true,
    hasMoreHistory: false,
  };
}

function resetStore(): void {
  useAppStore.setState(useAppStore.getInitialState(), true);
}

test("API settings replace only excluded runtime and session models with a non-excluded local model", (t) => {
  t.after(resetStore);
  useAppStore.setState({
    apiConfigSettings: { profiles: [profile] },
    runtimeModel: "excluded-model",
    sessions: {
      excluded: session("excluded", "excluded-model"),
      discovered: session("discovered", "discovered-model"),
      managed: session("managed", "managed-model"),
    },
    archivedSessions: {
      undeclared: session("undeclared", "undeclared-role-model"),
    },
  });

  useAppStore.getState().setApiConfigSettings({ profiles: [profile] });

  const state = useAppStore.getState();
  assert.equal(state.runtimeModel, "legacy-model");
  assert.equal(state.sessions.excluded?.model, "legacy-model");
  assert.equal(state.sessions.discovered?.model, "discovered-model");
  assert.equal(state.sessions.managed?.model, "managed-model");
  assert.equal(state.archivedSessions.undeclared?.model, "legacy-model");
});

test("runtime and session setters accept every non-excluded model from enabled local catalogs", (t) => {
  t.after(resetStore);
  const disabledProfile: ApiConfigProfile = {
    ...profile,
    id: "disabled-gateway",
    model: "disabled-model",
    models: [{ name: "disabled-model", catalogStatus: "managed" }],
    enabled: false,
  };
  useAppStore.setState({
    apiConfigSettings: { profiles: [profile, disabledProfile] },
    runtimeModel: "legacy-model",
    sessions: { active: session("active", "legacy-model") },
    archivedSessions: {},
  });

  useAppStore.getState().setRuntimeModel("managed-model", "gateway");
  assert.equal(useAppStore.getState().runtimeModel, "managed-model");
  assert.equal(useAppStore.getState().runtimeConfigProfileId, "gateway");

  useAppStore.getState().setRuntimeModel("discovered-model");
  assert.equal(useAppStore.getState().runtimeModel, "discovered-model");

  useAppStore.getState().setRuntimeModel("disabled-model");
  assert.equal(useAppStore.getState().runtimeModel, "legacy-model");

  useAppStore.getState().setSessionModel("active", "excluded-model");
  assert.equal(useAppStore.getState().sessions.active?.model, "legacy-model");

  useAppStore.getState().setSessionModel("active", "managed-model", "gateway");
  assert.equal(useAppStore.getState().sessions.active?.model, "managed-model");
  assert.equal(useAppStore.getState().sessions.active?.configProfileId, "gateway");

  useAppStore.getState().handleServerEvent({
    type: "session.status",
    payload: {
      sessionId: "active",
      status: "idle",
      model: "discovered-model",
    },
  });
  assert.equal(useAppStore.getState().sessions.active?.model, "discovered-model");

  useAppStore.getState().setSessionModel("active", "");
  assert.equal(useAppStore.getState().sessions.active?.model, undefined);
});
