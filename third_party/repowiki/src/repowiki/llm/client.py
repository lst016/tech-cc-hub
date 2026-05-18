"""OpenAI-compatible async LLM client for the embedded RepoWiki runner."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass
from collections.abc import AsyncGenerator
from urllib.parse import urlparse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

CODEX_OAUTH_BASE_HOST = "chatgpt.com"
CODEX_OAUTH_COMPACT_MODEL_SUFFIX = "-openai-compact"

logger = logging.getLogger(__name__)


def _env_positive_int(name: str, fallback: int, *, maximum: int) -> int:
    try:
        value = int(os.getenv(name, "").strip() or "0")
    except ValueError:
        return fallback
    if value <= 0:
        return fallback
    return min(value, maximum)


DEFAULT_TIMEOUT_SECONDS = _env_positive_int("TECH_CC_HUB_REPOWIKI_LLM_TIMEOUT", 300, maximum=1800)


@dataclass
class CodexCredential:
    access_token: str
    account_id: str


def _chat_completions_endpoint(api_base: str | None) -> str:
    base = (api_base or "https://api.openai.com/v1").rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    return f"{base}/chat/completions"


def _codex_responses_endpoint(api_base: str | None, model: str) -> str:
    base = (api_base or "https://chatgpt.com").rstrip("/")
    path = "/backend-api/codex/responses/compact" if model.endswith(CODEX_OAUTH_COMPACT_MODEL_SUFFIX) else "/backend-api/codex/responses"
    return f"{base}{path}"


def _codex_model_id(model: str) -> str:
    if model.endswith(CODEX_OAUTH_COMPACT_MODEL_SUFFIX):
        return model[: -len(CODEX_OAUTH_COMPACT_MODEL_SUFFIX)]
    return model


def _is_codex_base(api_base: str | None) -> bool:
    if not api_base:
        return False
    try:
        return urlparse(api_base).hostname == CODEX_OAUTH_BASE_HOST
    except Exception:
        return False


def _parse_codex_credential(raw: str) -> CodexCredential | None:
    trimmed = raw.strip()
    if not trimmed.startswith("{"):
        return None
    try:
        parsed = json.loads(trimmed)
    except json.JSONDecodeError as error:
        raise RuntimeError("Codex OAuth credential must be valid JSON.") from error
    if not isinstance(parsed, dict):
        raise RuntimeError("Codex OAuth credential must be a JSON object.")
    access_token = str(parsed.get("access_token") or parsed.get("accessToken") or "").strip()
    account_id = str(parsed.get("account_id") or parsed.get("accountId") or "").strip()
    if not access_token or not account_id:
        raise RuntimeError("Codex OAuth credential is missing access_token or account_id.")
    return CodexCredential(access_token=access_token, account_id=account_id)


def _message_content_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for item in content:
        if isinstance(item, dict):
            text = item.get("text") or item.get("content")
            if isinstance(text, str):
                parts.append(text)
    return "\n".join(parts)


def _build_codex_payload(model: str, messages: list[dict]) -> dict:
    instructions: list[str] = []
    input_items: list[dict] = []
    for message in messages:
        role = message.get("role")
        content = _message_content_text(message.get("content"))
        if not content:
            continue
        if role == "system":
            instructions.append(content)
        elif role == "assistant":
            input_items.append({"role": "assistant", "content": content})
        else:
            input_items.append({"role": "user", "content": content})
    if not input_items:
        input_items.append({"role": "user", "content": ""})
    return {
        "model": _codex_model_id(model),
        "instructions": "\n\n".join(instructions),
        "input": input_items,
        "store": False,
    }


def _extract_codex_text(payload: dict) -> str:
    direct_text = payload.get("output_text")
    if isinstance(direct_text, str) and direct_text:
        return direct_text

    output = payload.get("output")
    if not isinstance(output, list):
        return ""
    parts: list[str] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if isinstance(content, str):
            parts.append(content)
            continue
        if not isinstance(content, list):
            continue
        for part in content:
            if not isinstance(part, dict):
                continue
            text = part.get("text")
            if isinstance(text, str) and text:
                parts.append(text)
    return "\n".join(parts)


def _sanitize_error_message(message: object, secrets: list[str]) -> str:
    text = str(message)
    for secret in secrets:
        if secret and len(secret) >= 12:
            text = text.replace(secret, "[redacted]")
    return text


def _response_text_from_error(error: HTTPError) -> str:
    try:
        return error.read().decode("utf8", errors="replace")
    except Exception:
        return str(error)


class LLMClient:
    """async OpenAI-compatible chat client.

    The desktop app vendors RepoWiki as an embedded Python runner. Requiring
    users to install litellm in their global Python makes that runner fragile,
    so this client sticks to the Python standard library and the app's existing
    OpenAI-compatible API profile fields.
    """

    def __init__(self, model: str, api_key: str = "", api_base: str = ""):
        self.model = model
        self.api_key = api_key
        self.api_base = api_base or None
        self.codex_credential = _parse_codex_credential(api_key) if _is_codex_base(self.api_base) else None
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cost = 0.0

    async def complete(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        response_format: dict | None = None,
    ) -> str:
        """non-streaming completion, returns the full response text."""
        payload: dict = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format

        try:
            resp = await asyncio.to_thread(
                self._post_codex_responses if self.codex_credential else self._post_chat_completions,
                payload,
            )
        except Exception as e:
            error_text = self._sanitize_error(e)
            logger.error("LLM call failed: %s", error_text)
            return f"[LLM Error: {error_text}]"

        if isinstance(resp.get("error"), dict):
            return f"[LLM Error: {self._sanitize_error(resp['error'].get('message') or resp['error'])}]"

        usage = resp.get("usage") if isinstance(resp.get("usage"), dict) else {}
        self.total_input_tokens += int(usage.get("prompt_tokens") or usage.get("input_tokens") or usage.get("inputTokens") or 0)
        self.total_output_tokens += int(usage.get("completion_tokens") or usage.get("output_tokens") or usage.get("outputTokens") or 0)

        if self.codex_credential:
            return _extract_codex_text(resp)

        choices = resp.get("choices") if isinstance(resp.get("choices"), list) else []
        if not choices:
            return ""
        first = choices[0] if isinstance(choices[0], dict) else {}
        message = first.get("message") if isinstance(first.get("message"), dict) else {}
        content = message.get("content") or first.get("text") or ""
        return content if isinstance(content, str) else str(content)

    def _sanitize_error(self, error: object) -> str:
        secrets = [self.api_key]
        if self.codex_credential:
            secrets.append(self.codex_credential.access_token)
            secrets.append(self.codex_credential.account_id)
        return _sanitize_error_message(error, secrets)

    def _post_chat_completions(self, payload: dict) -> dict:
        data = json.dumps(payload, ensure_ascii=False).encode("utf8")
        headers = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        request = Request(
            _chat_completions_endpoint(self.api_base),
            data=data,
            headers=headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
                raw = response.read().decode("utf8", errors="replace")
        except HTTPError as error:
            raw = _response_text_from_error(error)
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                raise RuntimeError(raw or str(error)) from error
            if isinstance(payload, dict) and isinstance(payload.get("error"), dict):
                raise RuntimeError(payload["error"].get("message") or raw) from error
            raise RuntimeError(raw or str(error)) from error
        except URLError as error:
            raise RuntimeError(str(error.reason)) from error

        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError as error:
            raise RuntimeError(f"LLM returned non-JSON response: {raw[:400]}") from error
        if not isinstance(parsed, dict):
            raise RuntimeError(f"LLM returned unexpected response: {raw[:400]}")
        return parsed

    def _post_codex_responses(self, payload: dict) -> dict:
        credential = self.codex_credential
        if not credential:
            raise RuntimeError("Codex OAuth credential is not configured.")

        data = json.dumps(_build_codex_payload(self.model, payload.get("messages") or []), ensure_ascii=False).encode("utf8")
        headers = {
            "Authorization": f"Bearer {credential.access_token}",
            "chatgpt-account-id": credential.account_id,
            "OpenAI-Beta": "responses=experimental",
            "originator": "codex_cli_rs",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        request = Request(
            _codex_responses_endpoint(self.api_base, self.model),
            data=data,
            headers=headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
                raw = response.read().decode("utf8", errors="replace")
        except HTTPError as error:
            raw = _response_text_from_error(error)
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                raise RuntimeError(self._sanitize_error(raw or str(error))) from error
            if isinstance(payload, dict) and isinstance(payload.get("error"), dict):
                raise RuntimeError(self._sanitize_error(payload["error"].get("message") or raw)) from error
            raise RuntimeError(self._sanitize_error(raw or str(error))) from error
        except URLError as error:
            raise RuntimeError(self._sanitize_error(str(error.reason))) from error

        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError as error:
            raise RuntimeError(f"Codex returned non-JSON response: {self._sanitize_error(raw[:400])}") from error
        if not isinstance(parsed, dict):
            raise RuntimeError(f"Codex returned unexpected response: {self._sanitize_error(raw[:400])}")
        return parsed

    async def stream(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        """streaming completion, yields text chunks."""
        yield await self.complete(messages, temperature=temperature, max_tokens=max_tokens)
