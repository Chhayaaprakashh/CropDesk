# Nexus setup — status: UNVERIFIED

No Nexus documentation or credentials were available when this module was built (workspace empty, no `NEXUS_*` env vars).
Nothing below has been confirmed. No endpoint, model ID or response format has been invented in code.

## Needed from the Navigate Labs Nexus docs
| Item | Status |
|---|---|
| Base URL / auth header format | unknown |
| Vision model ID + request/response format | unknown |
| Speech-to-text model ID, supported languages (Kannada?) | unknown |
| LLM model IDs (need >= 2 for comparison) | unknown |
| Text-to-speech model ID, supported languages, audio format | unknown |
| Token usage in responses? Rate limits? | unknown |

## Wiring plan
`app/nexus/` will hold an abstract provider (vision, STT, LLM, TTS) and the real HTTP client, written only after the above is filled in.
Unit tests use an explicitly named test-only fake. `/capabilities` reports `nexus_configured` (env vars present) and `nexus_verified` (always false until a live check exists).
