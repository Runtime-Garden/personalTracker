# AI provider architecture and capabilities

## Scope

An **optional, policy-controlled AI assistant** usable in personal and team contexts. Users can choose provider/model and request natural-language search, summaries, prioritization and **proposed** actions. No hidden autonomy, no dependency on a common Runtime Garden agent platform or DeepSeek Harness. Personal Tracker owns its own connector configuration and limited tool interface.

## Provider strategy

Use an AI SDK-compatible provider registry with a stable app-owned interface:

`modelRef` → `{ providerId, modelId, endpointPolicyId, capabilities, modelContextBudget, pricingMode?, credentialScope }`.

Implement/test adapter tiers:

| Tier | Providers | Notes |
| --- | --- | --- |
| A — direct adapters | OpenAI, Anthropic, Google Gemini | First supported real backends; stream/text/tool capability separately tested |
| B — additional adapters | Azure OpenAI, Mistral, xAI, Groq, OpenRouter | Implement when matching stable SDK/compatible adapters verified |
| C — local/custom | Ollama, LM Studio, other approved OpenAI-compatible endpoints | Disable custom arbitrary base URLs by default; endpoint allowlists, HTTPS/private network rules |
| D — future | Bedrock, Vertex AI, Cohere, others | Connector plugin contract; **not** promise of out-of-box support |

Different providers have different tool calling, structured output, streaming, model listing and token accounting. Capability probing and per-model metadata is mandatory. Unsupported model features must be clearly disabled or gracefully rejected, not silently hallucinated. Local Ollama/LM Studio may require separate LAN access with explicit egress/SSRF policy and are not default public endpoints.

## Credential hierarchy

- `system` connectors: configured by system admin, policies/budgets; users may use but may never obtain plaintext keys.
- `workspace` connectors: configured by owner/admin and consented to by workspace, subject to site policy.
- `personal` connectors: each user BYOK; only own account can change encrypted credential.
- Order of selection: explicit current chat choice → user default → permitted workspace default → permitted system default. Respect “AI disabled” override.
- No credentials exposed to browser unless an explicit external auth flow demands a scoped token, which is avoided by default. Provider calls originate on server.

## Connector configuration UX

Provider catalog listing logo/name, configured state, supported model list, test connection, model chooser, token/cost tracking (only when supported), credential scope, data-sharing notice, rate limits, allowed host for custom endpoints. Show meaningful `unsupported`, `failed-auth`, `unreachable`, `rate-limited` states. Do not auto-enable all system models. List prices only from verified provider metadata; never invent live costs.

## Model registry contract

Fields: `id`, `provider`, `deploymentOrModelName`, `capabilities:{text,stream,toolCalling,structuredOutput,vision?}`, `maxOutputTokens?`, `contextWindow?`, `availabilityVerifiedAt?`, `credentialScope`, `enabled`, `privacyPolicyUri?`. Model list can be manually configured when remote list is unavailable; test capabilities independently of listing. Record verification timestamp.

## Request lifecycle

1. Session + workspace policy → check AI opt-in and provider ACL.
2. Normalize user query (bound length), choose model with capability and cost policy.
3. Build **limited authorized context** only via tenant-scoped retrieval; secrets/hidden fields never included.
4. Run provider with timeout, max rounds/tools/tokens, cancellation and streaming backpressure.
5. Validate tool call arguments; use allowlisted tool executor with policy, version and approval gates.
6. Emit structured references and action previews; redact response logs; record usage/latency only, conversations optional with opt-in and retention.
7. Report provider errors, timeout and degraded mode. Normal task CRUD remains operational while AI is down.

## Data privacy guarantees

Treat model output as untrusted. Document that using a remote AI provider sends selected task text/context externally; let workspace owners disable remote models, select local-only and control consent. Never send another workspace's data even if natural language requests it. Default no hidden vector index. Retrieval must use ACL **before** search, not just after the LLM receives results. Avoid persistent chat history unless opt-in and scoping/retention are implemented.

## Extensibility contract

Adapter must implement `validateConfiguration`, `healthCheck`, `listOrConfigureModels`, `invokeText`, `invokeStructured`, `stream` (when supported), `capabilities`, `normalizeUsage`, `cancel`. No direct DB access inside adapter. Tool calls go through executor; adapters may not register arbitrary privileged tools. Mock provider adapter essential for deterministic CI tests.

## Explicit limits of “all providers”

Support **all connectable providers through explicit adapters or verified compatible endpoints**, not every model/feature without development. Some endpoints don't support native tool calls, so planning-only/read-only mode should remain possible. Compatibility and security are acceptance-tested per provider/model, not inferred by branding.
