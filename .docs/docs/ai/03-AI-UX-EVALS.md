# AI experience, observability and evaluation

## UX placement

AI is accessible from consistent **Ask AI** button/command palette and optional resizable right rail (desktop). On mobile use full-height sheet/route; keep tasks usable without AI. Show workspace context prominently, current model/provider and optional data sharing notice. “Read”, “Propose changes”, “Apply reviewed changes” are visibly distinct modes. Explain unsupported features with actionable fallback.

## Suggested task requests

“Create three subtasks for this work item” → proposals; “What am I behind on?” → read-only aggregation; “Move this task to next sprint” → manager permission + confirmation; “Remind me tomorrow at 9” → actor timezone and explicit confirmation; “Summarize sprint blockers” → cite visible task links. Never make up task names, completed work or milestone dates.

## Response structure

Return natural language plus structured citations `[{type:'task',id,workspaceId,label}]`, tool result metadata, assumptions, risk/approval status, eventual action result. Each result must map to an authorized record. If insufficient context, ask one focused question rather than making destructive assumptions. Avoid exposing hidden IDs in user-facing messages.

## Evals and fixtures

| Dimension | Measurement | Negative fixture |
| --- | --- | --- |
| Permission adherence | unauthorized retrieval/action count = 0 | Ask for other user's private tasks |
| Tool accuracy | schema-valid call rate, execution correctness | fabricated ID and status |
| Grounding | cited facts match visible DB rows | made-up due date |
| Approval safety | 100% sensitive mutations confirmed | ambiguous bulk delete |
| Time accuracy | timezone/DST conversion rate | Riga fall-back hour |
| Provider resilience | error and timeout recovery | 429, malformed tool JSON |
| Utility | human-reviewed task planning usefulness | vague free-form goal |
| Cost/resource | tokens, latency, failures, price when available | runaway tool loop |

Use seeded **synthetic** fixtures, mock provider in CI and limited manual real-provider test with sanitized sample data. Record evaluations with dates, versions and observed results; do not invent benchmarks. Track errors, provider, model, elapsed time, token counts where available, without full raw user content by default.

## Cost/risk guardrails

Limits per user/workspace/instance: max output and context tokens, max tool iterations (e.g. 4 initially), max requested records (e.g. 50), request timeout, concurrent runs, daily usage budget. If usage cost unsupported, display unavailable instead of fake euros. Require admin authorization to configure system key budgets; users may opt out of AI.

## Conversation retention

Default ephemeral session with optional “save conversation” scoped to user/workspace, configurable retention and deletion. Saved chats must be included in user export/deletion policy when enabled. Team chats are not automatically visible to all team members unless intentionally shared; AI must not learn from private spaces by silent cross-workspace memory.
