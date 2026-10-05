# Canonical Model Catalog for Tiered Orchestration

**Verification:** each row carries the date it was last checked against the provider's own pages; `unverified` means no such check is recorded.  
**Scope:** Reference mapping of frontier Western and Chinese AI models to operational tiers (T1–T3) for multi-harness and multi-model project governance.

This catalog supplies the tier-to-model mapping in [execution-policy.template.md](../assets/execution-policy.template.md), which also defines tiers T0–T3. Verify API availability, identifiers, and current pricing against official provider documentation prior to locking budgets. For invocation flags and agent primitives, see [harness-parameters.md](harness-parameters.md).

## T1: Mechanical Models (Scout, Inventory, Fast Context)

Fast context extraction, project search, and deterministic-assisted tasks.

| Provider | Model Name | API Identifier | Origin | Context | In / Out (per 1M) | Cache In | Recommended Roles | Strengths | Verified |
|---|---|---|---|---|---|---|---|---|---|
| **Anthropic** | Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | Western | 200k | $1.00 / $5.00 | $0.10 | `scout`, `oracle` | Fastest current Claude model with near-frontier intelligence; extended thinking; 64K max output. | 2026-09-20 |
| **OpenAI** | GPT-5.6 Luna | `gpt-5.6-luna` | Western | 1M | $0.20 / $1.20 | $0.02 | `scout`, `oracle` | GPT-5.6 model optimized for cost-sensitive workloads; 128K max output. | 2026-09-20 |
| **Google** | Gemini 3.5 Flash-Lite | `gemini-3.5-flash-lite` | Western | 1M | $0.30 / $2.50 | n/a | `scout` | Low-latency, cost-effective multimodal model for high-throughput subagent tasks and document parsing; stable; 65,536 max output. | 2026-09-20 |
| **DeepSeek** | DeepSeek V4.1 Flash | `deepseek-flash` | Chinese | 1M | $0.30 / $1.20 | $0.006 | `scout` | 1M context and up to 384K output; supports non-thinking and thinking (default) modes. | 2026-09-20 |
| **Alibaba Cloud** | Qwen3.8 Flash | `qwen3.8-flash` | Chinese | 1M | $0.15 / $0.47 | n/a | `scout` | Fast multimodal Qwen model; thinking mode supported; 131,072 max output. | 2026-09-20 |

## T2: Standard Models (Driver, Implementation Workhorse)

Code authoring, test creation, and spec-directed changes.

| Provider | Model Name | API Identifier | Origin | Context | In / Out (per 1M) | Cache In | Recommended Roles | Strengths | Verified |
|---|---|---|---|---|---|---|---|---|---|
| **Anthropic** | Claude Sonnet 5 | `claude-sonnet-5` | Western | 1M | $2.00 / $10.00 | $0.20 | `driver` | Best combination of speed and intelligence; adaptive thinking; 128K max output. | 2026-09-20 |
| **OpenAI** | GPT-5.6 Terra | `gpt-5.6-terra` | Western | 1M | $2.00 / $12.00 | $0.20 | `driver` | GPT-5.6 model that balances intelligence and cost; 128K max output. | 2026-09-20 |
| **Google** | Gemini 3.8 Flash | `gemini-3.8-flash` | Western | 1M | $0.75 / $3.75 | $0.075 | `driver` | Most intelligent Flash model, engineered for long-horizon software engineering, agents, and enterprise workflows; stable; 65,536 max output. | 2026-09-20 |
| **Alibaba Cloud** | Qwen3.7 Plus | `qwen3.7-plus` | Chinese | 1M | $0.40 / $1.60 | n/a | `driver` | Cost-effective Plus model with agent-level intelligence for coding, tool use, and productivity workflows; thinking mode supported; 131,072 max output. | unverified |

## T3: Judgment & Reasoning Models (Reviewer, Arbiter, Architecture)

Contract design before code, adversarial review, and invariant verification.

| Provider | Model Name | API Identifier | Origin | Context | In / Out (per 1M) | Cache In | Recommended Roles | Strengths | Verified |
|---|---|---|---|---|---|---|---|---|---|
| **Anthropic** | Claude Opus 5 | `claude-opus-5` | Western | 1M | $5.00 / $25.00 | $0.50 | `reviewer`, `arbiter` | Complex agentic coding and enterprise work; Anthropic's suggested starting model for most workloads; adaptive thinking; 128K max output. | 2026-09-20 |
| **Anthropic** | Claude Fable 5.1 | `claude-fable-5-1` | Western | 1M | $10.00 / $50.00 | $0.25 | `arbiter`, `reviewer` | Demanding reasoning and long-horizon agentic work; adaptive thinking always on; slower than Opus 5; 128K max output. | 2026-09-20 |
| **OpenAI** | GPT-5.6 Sol | `gpt-5.6-sol` | Western | 1M | $4.00 / $20.00 | $0.40 | `reviewer` | Flagship model for complex professional work (alias gpt-5.6); 128K max output. | 2026-09-20 |
| **OpenAI** | GPT-6 Astra | `gpt-6-astra` | Western | 1M | $10.00 / $50.00 | $1.00 | `arbiter`, `reviewer` | OpenAI's most capable model, built for the hardest end-to-end work; 128K max output. | 2026-09-20 |
| **Google** | Gemini 3.1 Pro (Preview) | `gemini-3.1-pro-preview` | Western | 1M | $2.00 / $12.00 | $0.20 | `reviewer` | Refines the Gemini 3 Pro series with better thinking, token efficiency, and factual consistency for software engineering and agentic workflows; preview status; 65,536 max output. | 2026-09-20 |
| **DeepSeek** | DeepSeek V4 Pro | `deepseek-v4-pro` | Chinese | 1M | $1.32 / $3.96 | $0.044 | `reviewer` | Larger of the two V4 models (1.6T total, 49B active parameters); 1M context and up to 384K output; thinking mode on by default. | 2026-09-20 |
| **Alibaba Cloud** | Qwen3.8 Max | `qwen3.8-max` | Chinese | 1M | $2.00 / $6.00 | n/a | `reviewer`, `arbiter` | 2.4-trillion-parameter MoE flagship with strong coding and office-productivity results; thinking mode supported; 131,072 max output. | 2026-09-20 |

## Sources and notes

- **`claude-haiku-4-5-20251001`** (sources: <https://platform.claude.com/docs/en/about-claude/pricing>, <https://platform.claude.com/docs/en/models/overview>)
  - Retirement is not sooner than 2026-10-15 (Anthropic's stated commitment); plan a replacement for T1 use.
  - The alias haiku did not resolve to Haiku when tested with Claude Code; use the full id.
- **`claude-sonnet-5`** (sources: <https://platform.claude.com/docs/en/about-claude/pricing>, <https://platform.claude.com/docs/en/models/overview>)
  - $2/$10 was introductory pricing and is now the standard price; the planned increase to $3/$15 will not occur.
  - Claude 4.7 and later use a tokenizer that yields about 30% more tokens for the same text than Sonnet 4.6 and earlier, so per-task cost differs from the per-token price.
- **`claude-opus-5`** (sources: <https://platform.claude.com/docs/en/about-claude/pricing>, <https://platform.claude.com/docs/en/models/overview>)
  - Claude 4.7 and later use a tokenizer that yields about 30% more tokens for the same text than Sonnet 4.6 and earlier, so per-task cost differs from the per-token price.
- **`claude-fable-5-1`** (sources: <https://platform.claude.com/docs/en/about-claude/pricing>, <https://platform.claude.com/docs/en/models/overview>)
  - Cache hits are priced at 0.025x the base input price on this model, against 0.1x on the others.
  - Claude 4.7 and later use a tokenizer that yields about 30% more tokens for the same text than Sonnet 4.6 and earlier, so per-task cost differs from the per-token price.
- **`gpt-5.6-luna`** (sources: <https://developers.openai.com/api/docs/pricing>, <https://developers.openai.com/api/docs/models>)
  - Regional processing (data residency) endpoints carry a 10% uplift for models released on or after 2026-03-05.
- **`gpt-5.6-terra`** (sources: <https://developers.openai.com/api/docs/pricing>, <https://developers.openai.com/api/docs/models>)
- **`gpt-5.6-sol`** (sources: <https://developers.openai.com/api/docs/pricing>, <https://developers.openai.com/api/docs/models>)
- **`gpt-6-astra`** (sources: <https://developers.openai.com/api/docs/pricing>, <https://developers.openai.com/api/docs/models>)
- **`gemini-3.5-flash-lite`** (sources: <https://ai.google.dev/gemini-api/docs/pricing>, <https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite>)
  - The context-caching price read as $0.03 on one pass of the pricing page and as not available on another; it is left unrecorded.
- **`gemini-3.8-flash`** (sources: <https://ai.google.dev/gemini-api/docs/pricing>, <https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash>)
  - These prices apply through 2026-12-31. From 2027-01-01 the page lists input $1.50, output $7.50, and context caching $0.15.
- **`gemini-3.1-pro-preview`** (sources: <https://ai.google.dev/gemini-api/docs/pricing>, <https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview>)
  - Prices shown are for prompts up to 200k tokens. Above 200k: input $4.00, output $18.00, context caching $0.40.
  - Preview status: identifiers and prices can change before general availability.
- **`deepseek-flash`** (sources: <https://api-docs.deepseek.com/quick_start/pricing>, <https://api-docs.deepseek.com/news/news260424/>)
  - Peak rates are shown; off-peak rates are half. Peak hours are 01:00-04:00 and 06:00-10:00 UTC, Monday to Friday, excluding Chinese public holidays.
  - The retired names deepseek-v4-flash and deepseek-v4-flash-vision-exp are still accepted and served by this model at the Flash price.
- **`deepseek-v4-pro`** (sources: <https://api-docs.deepseek.com/quick_start/pricing>, <https://api-docs.deepseek.com/news/news260424/>)
  - Peak rates are shown; off-peak rates are half (same peak hours as deepseek-flash).
  - The tier is this catalog's judgment: DeepSeek's pages give no positioning statement for the model.
- **`qwen3.8-flash`** (sources: <https://www.alibabacloud.com/help/en/model-studio/model-pricing>, <https://www.alibabacloud.com/help/en/model-studio/qwen3-8-flash>)
  - Singapore/International pricing. A context-caching discount exists but its rate was not stated, so the cache price is unrecorded.
- **`qwen3.7-plus`** (sources: <https://www.alibabacloud.com/help/en/model-studio/model-pricing>, <https://www.alibabacloud.com/help/en/model-studio/qwen3-7-plus>)
  - Singapore/International pricing. Read once only: the $0.40 input price applies to 0-256K tokens, and the page also shows higher tiers and a limited-time 20% discount that were not resolved. Verify before budgeting.
- **`qwen3.8-max`** (sources: <https://www.alibabacloud.com/help/en/model-studio/model-pricing>, <https://www.alibabacloud.com/help/en/model-studio/qwen3-8-max>)
  - Singapore/International pricing. A context-caching discount exists but its rate was not stated, so the cache price is unrecorded.

## Recommended Pairing Strategy (Mode A)

Under **Mode A (Cross-Harness)**, the `driver` and `reviewer` never share a harness or subagent lineage. Each pairing uses model ids from this catalog and harness ids from [harness-parameters.md](harness-parameters.md).

| Strategy | Driver (harness / model) | Reviewer (harness / model) | Key advantage |
|---|---|---|---|
| **Claude drives, GPT reviews** | `claude-code` / `claude-sonnet-5` | `codex` / `gpt-5.6-sol` | Independent vendors and harnesses, so no shared context, prompts, or blind spots. Both CLIs were checked against the installed versions. |
| **GPT drives, Claude reviews** | `codex` / `gpt-5.6-terra` | `claude-code` / `claude-opus-5` | The reverse of the first pairing; the reviewer runs read-only under --permission-mode plan. |
| **Budget review** | `claude-code` / `claude-sonnet-5` | `pi-dev` / `deepseek-v4-pro` | Lowest-priced T3 reviewer in this catalog at peak rates. The pi DeepSeek preset ids are unchecked, so confirm the preset before relying on it. |
