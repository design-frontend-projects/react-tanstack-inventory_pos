# Tasks — Enterprise CRM (Feature 003)

## Phase 0 — Outbox foundation ✅

- [X] T001 `prisma/schema.prisma`: `DomainEvent` (`domain_events`, bigserial id + unique eventId uuid) + `CrmProjectionCursor` (`crm_projection_cursors`); migration `phase0_crm_outbox`.
- [X] T002 `src/server/events/domain-event-types.ts` (typed event catalog + payload map, Decimals as strings) and `src/server/events/event-outbox.ts` (`appendDomainEvent(tx, input)`).
- [X] T003 `src/server/repos/domain-event-repo.ts` (`appendEvent`, `listEventsAfter`, `pruneEventsBefore`) + `src/server/repos/crm-projection-cursor-repo.ts` (`getCursor`, `advanceCursor`).
- [X] T004 Emission call sites inside existing transactions: `pos-sale-service.ts` (complete/void — void wrapped in `$transaction`), `sales-order-service.ts` (confirm/fulfill/cancel — confirm wrapped), `sales-invoice-service.ts` (issue wrapped / full payment), `sales-return-service.ts` (POS refund → `pos_sale.refunded`), `financial-note-service.ts` (issue wrapped + `sales_return.credited` on credit-note creation), `catalog-service.ts` (customer create/update wrapped in `$transaction`).
- [X] T005 `tests/unit/crm-events.test.ts`: payload Decimal-string contract, event-type catalog totality.

## Phase 1 — Customer profile satellites + RBAC ✅

- [X] T010 Schema: `CrmCustomerProfile`, `CrmCustomerContact`, `CrmCustomerAddress`, `CrmCustomerRelationship`, `CrmCommunicationConsent`, `CrmCustomerPreference`, `CrmTag`+`CrmCustomerTag`, `CrmCustomerGroup`+`CrmCustomerGroupMember`, `CrmCustomFieldDefinition`+`CrmCustomFieldValue` + enums; migration `phase1_crm_profile`.
- [X] T011 Repos: `crm-customer-profile-repo.ts` (profile/contacts/addresses/relationships/preferences/consents), `crm-tag-repo.ts` (tags/assignments/groups/members), `crm-custom-field-repo.ts`.
- [X] T012 `src/server/crm/customer-profile-service.ts` (+ consent-change events) and `src/server/crm/crm-dto.ts`.
- [X] T013 `src/features/crm/validation.ts` + `src/features/crm/server-functions.ts` (profile slice).
- [X] T014 RBAC: `crm` module + 4 screens in `module-catalog.ts`, `crm.*` permissions + `crm_manager` role + role-map deltas in `rbac-catalog.ts`, `PERMISSION_LINKS` entries, nav mirror in `src/lib/navigation/app-nav.ts` + placeholder routes `src/routes/_app/crm/*` + i18n keys (en/ar), reseed.
- [X] T015 `tests/unit/crm-rbac.test.ts`: permissions registered/linked/mapped; role gets expected grants.

## Phase 2 — Timeline + projector core ✅

- [X] T020 Schema: `CrmTimelineEntry` (`sourceEventId @unique`); migration `phase2_crm_timeline`.
- [X] T021 `src/server/crm/projector.ts` (advisory xact lock, cursor batching, handler dispatch) + `src/server/repos/crm-timeline-repo.ts`.
- [X] T022 `src/server/crm/timeline-mapper.ts` (pure event→entry) + `src/server/crm/projections/timeline-projection.ts`.
- [X] T023 `src/server/crm/timeline-service.ts` + server fns `listCustomerTimeline`, `addTimelineNote`, `runCrmProjector`.
- [X] T024 Tests: mapper vectors (`tests/unit/crm-timeline.test.ts`). Harness-gated idempotent replay: deferred follow-up (see Phase 8).

## Phase 3 — Loyalty engine ✅

- [X] T030 Schema: `CrmLoyaltySettings`, `CrmLoyaltyTier`, `CrmLoyaltyAccount`, `CrmLoyaltyLedgerEntry`, `CrmLoyaltyEarnRule` + enums; migration `phase3_crm_loyalty`.
- [X] T031 `src/server/crm/loyalty-rules.ts` (earn calc, tier determination, redemption validation, FIFO expiry lots).
- [X] T032 `src/server/repos/crm-loyalty-repo.ts` (incl. `ensureAndLockAccount` FOR UPDATE) + `src/server/crm/loyalty-service.ts` (sync redeem/adjust, auto-earn entry point, scheduled expire, tier recalc, settings/tiers/rules CRUD, legacy `Customer.loyaltyPoints` cache sync).
- [X] T033 `src/server/crm/projections/loyalty-projection.ts` (auto-earn on `pos_sale.completed`/`sales_order.fulfilled`, `sourceEventId`-idempotent).
- [X] T034 Server fns: account/ledger reads, `redeemPoints`, `adjustPoints`, settings/tiers/rules, `expireLoyaltyPoints`.
- [X] T035 `tests/unit/crm-loyalty.test.ts`: earn/tier/expiry golden vectors; FIFO exactness; RBAC wiring covered in crm-rbac tests.

## Phase 4 — Metrics & intelligence ✅

- [X] T040 Schema: `CrmCustomerMetrics` (`lastEventSequence` guard) + `CrmCustomerMetricsMonthly`; migration `phase4_crm_metrics`.
- [X] T041 `src/server/repos/crm-metrics-repo.ts` + `src/server/crm/metrics-fold.ts` (pure fold) + `src/server/crm/projections/metrics-projection.ts` + `src/server/crm/metrics-service.ts`.
- [X] T042 `src/server/crm/rfm-scoring.ts` + `src/server/crm/churn-heuristics.ts`.
- [X] T043 Server fns: `getCustomerMetrics`, `getCrmDashboard`.
- [X] T044 `tests/unit/crm-metrics.test.ts`: fold vectors, order-independence, RFM/CLV/churn math.

## Phase 5 — Segmentation ✅

- [X] T050 Schema: `CrmSegment` + `CrmSegmentMember`; migration `phase5_crm_segments`.
- [X] T051 `src/server/crm/segment-evaluator.ts` (rule tree + Zod schema shared with validation) + `src/server/crm/customer-facts.ts` (facts builder).
- [X] T052 `src/server/repos/crm-segment-repo.ts` + `src/server/crm/segment-service.ts` (CRUD, batch rebuild, incremental evaluate) + `src/server/crm/projections/segment-projection.ts` (+ enter/exit events).
- [X] T053 Server fns: `listSegments`, `upsertSegment`, `deleteSegment`, `rebuildSegment`, `listSegmentMembers`.
- [X] T054 `tests/unit/crm-segments.test.ts`: evaluator vectors, schema validation.

## Phase 6 — AI-ready scores ✅

- [X] T060 Schema: `CrmCustomerScore`; migration `phase6_crm_scores`; `src/server/repos/crm-score-repo.ts`.
- [X] T061 Wire `churn-heuristics.ts` as `modelName='heuristic-v1'` writer from the metrics projection (`scoreType='churn'` + `featuresJson` snapshot).
- [X] T062 Contract documented in `data-model.md`.

## Phase 7 — Deferred contexts (design-only)

- [ ] T070 Campaigns/coupons schema + events + `campaign-service.ts` stub with `crm-state-machines.ts` campaign machine.
- [ ] T071 Tickets (`CRM_TICKET` document type, ticket machine) + messages.
- [ ] T072 Feedback (NPS/CSAT/reviews) + satisfaction aggregation.
- [ ] T073 Dining reservations + restaurant event contracts; delivery event contracts.

## Phase 8 — Ops (design-only)

- [ ] T080 Outbox prune job (`pruneEventsBefore` below min cursor, >90d).
- [ ] T081 Historical backfill via synthetic events (harness-gated script).
- [ ] T082 Per-projection cursors (scale path); RLS enablement runbook execution.

Status legend: [X] done · [ ] pending.
