# Synapsek accounting connector trial

This candidate fixes connector discovery so Hebri preserves operation input
schemas from the authenticated Synapsek broker. Previously every read used an
empty schema, preventing an agent from requesting page 2 of accounting results.
Legacy catalogs still receive their strict empty-read/Slack-write schemas.
No core tool, provider token storage or profile scope was added or changed.

The paired website/runtime update exposes QuickBooks company information,
customer/supplier lists and invoice/bill/payment summaries, plus Xero contacts
and invoice/bill/payment summaries. Xero requires explicit organisation selection;
QuickBooks binds reads to the verified company. These are read-only trial tools,
not invoice creation, payment execution or a complete accounting ledger.

Availability is controlled by the server's reviewed catalog and rollout cohort.
Installing this build alone does not activate managed connectors. The administrator
must deploy the paired website/runtime, verify the existing staging migration,
configure Nango integrations, and enable the explicit test cohort. The team must
complete provider consent and live acceptance before wider rollout. Full setup,
root-cause details and acceptance are maintained in the website repository at
`docs/hebri-accounting-trial.md`.

For the trial: sign in with the allowlisted Synapsek account, open the intended Bit,
start a new chat, ask to connect QuickBooks or Xero, and complete the connection in
the Synapsek browser page. Choose the intended company/organisation yourself. Other
Bits do not inherit access. Existing chats can retain old tool schemas.

Ask for record summaries and all available pages; results include `nextPage`,
`truncated` and limitations. Do not treat one page as the complete books or infer
zero from an omitted amount. Reconnect if company authority changes. Removing Bit
access does not uninstall the provider app or revoke all provider-side consent.

Automated validation: the canonical `scripts/run_tests.sh` runner passed
`tests/tools/test_synapsek_connector_schemas.py` and
`tests/hermes_cli/test_synapsek_connectors.py`: 7 tests, retries disabled.
This includes actual ConnectorClient schema parsing, page forwarding, legacy
schema fallback and the existing profile-isolation checks. Provider responses are
mocked; live acceptance and native keychain qualification remain outstanding.
