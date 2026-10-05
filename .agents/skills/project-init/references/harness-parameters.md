# Agent Harness Invocation & Parameter Reference

**Verification:** each card carries the date its flags were last checked against the installed CLI or the provider's docs; `not yet` means no such check is recorded.  
**Scope:** Definitive command templates, CLI flags, internal agent primitives, and parameter constraints for major agent harnesses to eliminate trial-and-error model selection.

Use this reference to construct execution commands and to bind the harness roster in [execution-policy.template.md](../assets/execution-policy.template.md).

## Operating Rules

1. **Snapshot first, then verify:** Take flags from a card. When a command fails, or the card's Verified date is more than 90 days old or `not yet`, confirm the flag with the harness's `--help` or the provider's documentation, and report the difference so the card can be refreshed.
2. **Run non-interactively:** Start background subagents with the harness's non-interactive form (`-p`, `--message`, `--headless`, `exec`) so the CLI cannot block on a prompt, and grant only the permission the role needs (see each card's constraints). Provider reasoning-parameter rules live in the Direct Provider API card.

## Harness Reference Cards

### Pi Coding Agent (pi.dev) (`pi-dev`)

- **Binary:** `pi`
- **Installation:** `npm install -g --ignore-scripts @earendil-works/pi-coding-agent`
- **Website:** https://pi.dev
- **Type:** `cli`
- **Verified:** 2026-09-20

**Key CLI Flags:**

| Purpose | Flag Syntax |
|---|---|
| `model` | `--model {model_id}` |
| `headless_prompt` | `-p "{prompt}"` |
| `mode` | `--mode text\|json\|rpc` |
| `restricted_tools` | `--tools {comma_separated_tools}` |
| `exclude_tools` | `--exclude-tools {tool_name}` |
| `system_prompt` | `--system-prompt "{text}"` |
| `append_system_prompt` | `--append-system-prompt "{text}"` |

**Operational Tier Presets (Copy-Pasteable):**

- **T1 (`scout`):**
  ```bash
  pi --model deepseek/deepseek-chat --tools read,grep,find,ls -p "{prompt}"
  ```
- **T2 (`driver`):**
  ```bash
  pi --model sonnet -p "{prompt}"
  ```
- **T3 (`reviewer`):**
  ```bash
  pi --model sonnet:high --tools read,grep,find,ls -p "{prompt}"
  ```
- **T3_budget (`reviewer`):**
  ```bash
  pi --model deepseek/deepseek-r1 --tools read,grep,find,ls -p "{prompt}"
  ```

**Constraints:**

- Always pass -p / --print in non-interactive sessions to avoid TUI terminal lockup.
- Always use --tools read,grep,find,ls when running in reviewer or scout role to enforce read-only boundary.
- Unchecked: the DeepSeek preset ids use pi's provider/id form, and the pi install used for the last check lists no DeepSeek models.

### Claude Code CLI (`claude-code`)

- **Binary:** `claude`
- **Installation:** `npm install -g @anthropic-ai/claude-code`
- **Type:** `cli`
- **Verified:** 2026-09-20

**Key CLI Flags:**

| Purpose | Flag Syntax |
|---|---|
| `model` | `--model {model_id}` |
| `headless_prompt` | `-p "{prompt}"` |
| `stdin_prompt` | `echo "{prompt}" \| claude -p` |
| `permission_mode` | `--permission-mode acceptEdits\|plan\|auto\|dontAsk\|bypassPermissions\|manual` |
| `effort` | `--effort low\|medium\|high\|xhigh\|max` |
| `output_format` | `--output-format json\|text` |

**Operational Tier Presets (Copy-Pasteable):**

- **T1 (`scout`):**
  ```bash
  claude -p "{prompt}" --model claude-haiku-4-5-20251001 --permission-mode plan
  ```
- **T2 (`driver`):**
  ```bash
  claude -p "{prompt}" --model sonnet --permission-mode acceptEdits
  ```
- **T3 (`reviewer`):**
  ```bash
  claude -p "{prompt}" --model opus --effort high --permission-mode plan
  ```

**Constraints:**

- Run with -p in non-interactive subagent sessions; without it the CLI blocks waiting for stdin.
- Use a --permission-mode the role needs: plan for scout and reviewer (no edits), acceptEdits for driver.
- Temperature is not configurable through Claude Code CLI flags.
- Use the aliases sonnet and opus, which resolve to the latest model of each family. Use the full id claude-haiku-4-5-20251001 for Haiku: in the last check the alias haiku ran a Sonnet model.

### Aider CLI (`aider`)

- **Binary:** `aider`
- **Installation:** `pip install aider-chat`
- **Type:** `cli`
- **Verified:** not yet

**Key CLI Flags:**

| Purpose | Flag Syntax |
|---|---|
| `model` | `--model {model_id}` |
| `reasoning_effort` | `--reasoning-effort {low\|medium\|high}` |
| `thinking_tokens` | `--thinking-tokens {tokens}` |
| `headless_prompt` | `--message "{prompt}"` |
| `prompt_file` | `--message-file {file_path}` |
| `auto_approve` | `--yes --no-auto-commits` |
| `architect_mode` | `--architect --model {reasoning_model} --editor-model {coding_model}` |

**Operational Tier Presets (Copy-Pasteable):**

- **T1 (`scout`):**
  ```bash
  aider --model deepseek/deepseek-chat --message "{prompt}" --yes --no-auto-commits --read-only
  ```
- **T2 (`driver`):**
  ```bash
  aider --model claude-3-7-sonnet-20250219 --message "{prompt}" --yes --no-auto-commits
  ```
- **T3 (`reviewer`):**
  ```bash
  aider --model openrouter/deepseek/deepseek-r1 --reasoning-effort high --message "{prompt}" --yes --no-auto-commits --read-only
  ```

**Constraints:**

- Always include --yes in scripts to prevent blocking interactive commit/git prompts.
- Include --no-auto-commits when running inside task-owned delivery loops.

### OpenCode CLI (`opencode`)

- **Binary:** `opencode`
- **Type:** `cli`
- **Verified:** not yet

**Key CLI Flags:**

| Purpose | Flag Syntax |
|---|---|
| `model` | `--model {model_id}` |
| `run_file` | `run -f {file_path}` |
| `headless` | `--headless` |
| `auto_approve` | `--auto-approve` |

**Operational Tier Presets (Copy-Pasteable):**

- **T1 (`scout`):**
  ```bash
  opencode run -f {prompt_file} --model gpt-4o-mini --headless --auto-approve
  ```
- **T2 (`driver`):**
  ```bash
  opencode run -f {prompt_file} --model gpt-4o --headless --auto-approve
  ```
- **T3 (`reviewer`):**
  ```bash
  opencode run -f {prompt_file} --model o3-mini --headless --auto-approve
  ```

**Constraints:**

- Run with --headless in unattended automation.

### Codex CLI (`codex`)

- **Binary:** `codex`
- **Type:** `cli`
- **Verified:** 2026-09-20

**Key CLI Flags:**

| Purpose | Flag Syntax |
|---|---|
| `headless_prompt` | `exec "{prompt}"` |
| `model` | `-m, --model {model_id}` |
| `sandbox` | `-s, --sandbox read-only\|workspace-write\|danger-full-access` |
| `json_events` | `--json` |
| `last_message_file` | `-o, --output-last-message {file_path}` |

**Operational Tier Presets (Copy-Pasteable):**

- **T1 (`scout`):**
  ```bash
  codex exec -s read-only "{prompt}"
  ```
- **T2 (`driver`):**
  ```bash
  codex exec -s workspace-write "{prompt}"
  ```
- **T3 (`reviewer`):**
  ```bash
  codex exec -s read-only "{prompt}"
  ```

**Constraints:**

- Run non-interactively with exec; the bare command opens the interactive UI.
- Set the sandbox to the role: read-only for scout and reviewer, workspace-write for driver.

### Cline / Roo-Code Config (`cline-roo`)

- **Type:** `configuration_file`
- **Verified:** not yet

**Operational Tier Presets (Copy-Pasteable):**

- **T1 (`scout`):**
  ```json
{
    "apiProvider": "deepseek",
    "apiModelId": "deepseek-chat",
    "autoApprove": [
        "read",
        "command"
    ]
}
  ```
- **T2 (`driver`):**
  ```json
{
    "apiProvider": "anthropic",
    "apiModelId": "claude-3-7-sonnet-20250219",
    "autoApprove": [
        "read",
        "write",
        "command"
    ]
}
  ```
- **T3 (`reviewer`):**
  ```json
{
    "apiProvider": "deepseek",
    "apiModelId": "deepseek-reasoner",
    "autoApprove": [
        "read"
    ]
}
  ```

**Constraints:**

- Leave temperature unset for deepseek-reasoner and thinking models in config.

### Antigravity Agent Primitive (invoke_subagent) (`antigravity-subagent`)

- **Type:** `agent_primitive`
- **Verified:** not yet

**Operational Tier Presets (Copy-Pasteable):**

- **T1 (`scout`):**
  ```python
  invoke_subagent(Subagents=[{'TypeName': 'research', 'Role': 'Codebase Scout', 'Model': 'flash_lite', 'Prompt': '...'}])
  ```
- **T2 (`driver`):**
  ```python
  invoke_subagent(Subagents=[{'TypeName': 'self', 'Role': 'Feature Driver', 'Model': 'flash', 'Prompt': '...'}])
  ```
- **T3 (`reviewer`):**
  ```python
  invoke_subagent(Subagents=[{'TypeName': 'self', 'Role': 'Adversarial Reviewer', 'Model': 'pro', 'Prompt': '...'}])
  ```

**Constraints:**

- Pass only 'flash_lite', 'flash', 'pro', or 'inherit' as the Model of invoke_subagent.

### Direct Provider API Request Parameters (`direct-api`)

- **Type:** `api`
- **Verified:** not yet

**Provider API Parameter Rules:**

- **Anthropic:** When thinking is enabled ({'type': 'enabled', 'budget_tokens': N}), leave temperature unset or use exactly 1.0; any other value returns HTTP 400.
- **Openai:** For reasoning models (o1, o3-mini), send reasoning_effort ('low' | 'medium' | 'high') and omit temperature, top_p, and presence_penalty.
- **Deepseek:** For deepseek-reasoner (R1), temperature is fixed by the provider, so omit it. For deepseek-chat, use temperature=0.0 for deterministic coding.
- **Google:** For gemini-2.0-flash-thinking-exp, set thinkingConfig in generationConfig. Pass temperature=0.0 for deterministic code checks.
