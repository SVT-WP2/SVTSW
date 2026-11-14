/**
 * The differences between the C++ agent and svt-db-agent-next that are decisions, not bugs
 * (`docs/01-behaviour-decisions.md`; ids `D-…`, `R-…`, `X-…`, `Q-…` from `DbAgent/docs/07`).
 * A case listed here may differ; one that is not listed must not. The compare spec fails on any other
 * difference, so a parity failure is either a bug or a decision that still has to be written down here.
 *
 * An entry covers whole cases. Each one lists only the cases whose every difference the decision explains;
 * a case that also shows a bug or an open question stays out (see `docs/03-parity-testing.md` §5).
 * Classified against the recordings of 2026-11-14 (the clone re-recorded after the paging and JSON fixes).
 */
export type ParityKnownDifference = {
    /** Case ids, or patterns over them. */
    cases: (string | RegExp)[]
    /** The decision that explains the difference. */
    decision: string
    note: string
}

/** The list messages of the read group, by case-id prefix (`chip-blocks` has its own entry). */
const LISTS = [
    'wafer-types', 'wafers', 'asics', 'chips', 'equipment-types', 'equipment', 'wp-machines', 'wp-probe-cards',
    'wp-projects', 'svt-test-setups', 'svt-test-setup-configs', 'svt-test-types', 'svt-test-type-configs',
    'svt-test-templates', 'svt-tests',
]

const each = (groups: string[], name: string): string[] => groups.map((group) => `${group}/${name}`)

export const PARITY_KNOWN_DIFFERENCES: ParityKnownDifference[] = [
    // ── Engine: filters, paging, errors ────────────────────────────────────────────────────────────────────
    {
        cases: [/^chip-blocks\//],
        decision: '07 §1',
        note: 'The C++ has no chip-block handler ("Request GetAllBlocks not Found"); the clone implements it (01 §3) '
            + 'under `GetAllBlocks`, the type the BFF sends.',
    },
    {
        cases: [...each(LISTS, 'filter-ids-true'), 'svt-test-types/filter-dutTypes-no-match'],
        decision: 'Q-F1',
        note: 'A filter value of the wrong type (`ids: true`) or a string outside the column\'s enum is a `BadRequest`; '
            + 'the C++ ignored it and returned every row (X-6).',
    },
    {
        cases: [
            ...each(LISTS, 'filter-ids-mixed'),
            'flow/wafer-create-duplicate', 'flow/wp-machine-unload-empty', 'envelope/unknown-type',
            'contract/get-all-chip-blocks-contract-name',
        ],
        decision: 'R-9',
        note: 'Same status, another message: the C++ texts and the SQL they echo are not reproduced (01 §2, §5). '
            + '`GetAllChipBlocks` is served by neither agent.',
    },
    {
        cases: [...each(LISTS, 'pager-beyond'), ...each(LISTS, 'pager-limit-null')],
        decision: 'X-4',
        note: 'Paging in the database: an offset past the end gives `items: []` with the real `totalCount`, and '
            + '`limit: null` falls back to 20; the C++ answered `BadRequest` (offset out of range, JSON type error).',
    },
    {
        cases: ['asics/all', 'asics/filter-ids-empty', 'asics/filter-ids-null', 'asics/filter-null'],
        decision: 'R-13',
        note: 'More than 5000 ASICs without a pager: the C++ replied `items: [], totalCount: 0`, the clone every row.',
    },
    {
        cases: [/^envelope\/(no-type|non-string-type|not-json|empty-type)$/],
        decision: 'X-10',
        note: 'A record without a string `type` is answered `BadRequest` (`UnknownRequestReply`); the C++ process '
            + 'exited on three of them and gave no reply.',
    },
    {
        cases: ['envelope/missing-correlation-id', 'envelope/missing-reply-topic'],
        decision: '01 §2 (reply topic)',
        note: 'A record without `kafka_correlationId` or `kafka_replyTopic` is an event for NestJS and gets no reply '
            + '(svt.db-agent-next.kafka.yaml); the C++ replied to the fixed topic.',
    },
    {
        cases: ['wafers/location-history-missing', 'wafer-types/map-missing', 'flow/wafer-update-missing'],
        decision: 'R-8',
        note: '`NotFound` for a missing id; the C++ knew only `Success` and `BadRequest`.',
    },
    {
        cases: [
            'wafers/location-history', 'chips/location-history', 'equipment/location-history',
            'flow/wafer-location-at-creation', 'flow/chip-location-at-creation',
            'flow/equipment-location-at-creation', 'flow/wafer-history-after-moves',
        ],
        decision: 'R-12',
        note: 'Location histories carry `totalCount` as every other list.',
    },
    // ── Handlers ───────────────────────────────────────────────────────────────────────────────────────────
    {
        cases: ['asics/filter-chipId-match', 'asics/filter-chipId-no-match'],
        decision: 'D-6',
        note: '`GetAllAsics.chipId` filters; the C++ failed with "Error: getting entries".',
    },
    {
        cases: ['chips/filter-familyTypes-match', 'chips/filter-familyTypes-no-match'],
        decision: 'D-5',
        note: '`GetAllChips.familyTypes` filters; the C++ looked for a `familyType` column in `Chip`.',
    },
    {
        cases: [
            'chips/all', 'chips/filter-ids-one', 'chips/filter-ids-several', 'chips/filter-ids-empty',
            'chips/filter-ids-null', 'chips/filter-null', 'chips/filter-generalLocation-match',
            'chips/filter-serialNumber-match', 'chips/pager-first', 'chips/pager-offset-only',
            'flow/chip-create', 'flow/chip-created',
        ],
        decision: 'R-10',
        note: 'Chips without `asicId`, as the contract\'s `ChipDto`; the C++ added the column.',
    },
    {
        cases: ['flow/chips-create-many'],
        decision: 'R-2',
        note: '`CreateManyChips` replies with the created chips only (and without `asicId`, R-10); the C++ listed all.',
    },
    {
        cases: ['contract/chips-create-many-contract-shape'],
        decision: 'D-8',
        note: 'The contract shape (`data.create.items` only) is accepted; the C++ also required `data.items`.',
    },
    {
        cases: ['svt-test-types/filter-dutTypes-match'],
        decision: 'D-4',
        note: '`GetAllSvtTestTypes.dutTypes` filters (any match); the C++ answered no item.',
    },
    {
        cases: [
            /^svt-tests\/filter-(dutEntityNames|dutId|testResultStatuses|testTypeConfigIds|testSetupConfigIds)-/,
            /^svt-tests\/filter-(createdAt|startedAt|finishedAt)(From|To)-/,
            'flow/tests-by-status', 'flow/tests-by-started-from',
        ],
        decision: 'D-3',
        note: 'Every contract filter of `GetAllSvtTests` works; the C++ allowed `ids` only.',
    },
    {
        cases: [
            'svt-tests/all', 'svt-tests/filter-ids-one', 'svt-tests/filter-ids-several', 'svt-tests/filter-ids-empty',
            'svt-tests/filter-ids-null', 'svt-tests/filter-null', 'svt-tests/pager-first', 'svt-tests/pager-second',
            'svt-tests/pager-offset-only',
        ],
        decision: 'R-6, dev-plan/05 §11',
        note: 'Test timestamps are ISO 8601 UTC (the C++ sent PostgreSQL text), and tests list newest first (`id desc`) '
            + 'for the UI grid; the C++ listed by ascending id.',
    },
    {
        cases: ['enums/all', 'enums/empty-list'],
        decision: '01 §3 (test state machine)',
        note: '`testResultStatus` has `CANCELLED` from migration 2.',
    },
    {
        cases: ['enums/filter-enumNames', 'enums/data-enumsNames', 'enums/unknown-name'],
        decision: 'D-2',
        note: 'The requested enum names filter the reply (`filter.enumNames`, and the contract\'s `data.enumsNames`); '
            + 'the C++ ignored both keys and returned every enum.',
    },
    {
        cases: ['svt-test-setup-configs/body-missing', 'svt-test-type-configs/body-missing'],
        decision: 'X-12',
        note: '`Get*ConfigBody` of an unknown id is `NotFound`; the C++ replied `Success` with no entity.',
    },
    {
        cases: [
            'flow/wafer-move-1', 'flow/wafer-move-2', 'flow/wafer-after-moves', 'flow/chip-move', 'flow/chip-after-move',
            'flow/chips-after-create-many', 'flow/equipment-move', 'flow/equipment-after-move',
        ],
        decision: 'X-9',
        note: 'The row just written is the current location; the C++ took the newest by `date`, and the creation row '
            + '(dated the day of the run) outranked the moves (dated 2026-11-09). The chip cases also lack `asicId` (R-10).',
    },
    {
        cases: [
            'flow/test-setup-create', 'flow/test-setup-created', 'flow/test-setup-update-default',
            'flow/test-setup-config-create', 'flow/test-setup-config-body', 'flow/test-setup-configs-created',
            'flow/test-create', 'flow/test-start', 'flow/test-finish',
            'flow/test-created',
        ],
        decision: 'X-5, X-1',
        note: 'The C++ failed `CreateSvtTestSetup` on the empty default-config relation (`vector::_M_range_check`) after '
            + 'committing the setup row; every later step of the test flow differs from there (ids, missing rows).',
    },
    {
        cases: ['flow/test-template-create-disabled', 'flow/test-template-created'],
        decision: 'D-12',
        note: '`isEnabled: false` is stored; the C++ dropped it.',
    },
    {
        cases: ['flow/test-type-update-contract-shape', 'flow/test-type-update-code-shape'],
        decision: 'D-1',
        note: '`UpdateSvtTestType` takes the contract shape `{ id, update: { dutTypes } }` and rejects the code shape.',
    },
    {
        cases: ['contract/wafer-type-create-contract-shape', 'envelope/no-data'],
        decision: 'D-7',
        note: 'The contract shape of `CreateWaferType` is accepted; the extra wafer type it creates is the one more '
            + 'item of `envelope/no-data`.',
    },
    {
        cases: ['contract/wafer-create-optional-keys-omitted'],
        decision: 'D-9',
        note: 'Optional dates may be left out.',
    },
    {
        cases: ['contract/equipment-create-without-specification'],
        decision: 'D-10',
        note: 'Optional `specification` may be left out.',
    },
    {
        cases: ['contract/wafer-move-without-date'],
        decision: 'D-11',
        note: '`Update*Location.date` may be left out.',
    },
    {
        cases: ['contract/wafer-create-quote-in-serial'],
        decision: 'X-2',
        note: 'Bound parameters: a quote in a value is stored; the C++ broke its concatenated SQL.',
    },
    {
        cases: ['contract/wp-machine-uninstall', 'contract/wp-machine-after-uninstall'],
        decision: 'D-13',
        note: 'Uninstalling a probe card clears the machine; the C++ failed on the `NOT NULL` history column.',
    },
    {
        cases: ['contract/test-setup-config-object-body', 'contract/wp-project-object-map'],
        decision: 'R-7',
        note: 'A JSON field sent as an object is a `BadRequest`; the C++ stored it (or dropped it) and replied `Success`.',
    },
]

export function findKnownDifference(caseId: string): ParityKnownDifference | undefined {
    return PARITY_KNOWN_DIFFERENCES.find((known) => known.cases.some((pattern) =>
        typeof pattern === 'string' ? pattern === caseId : pattern.test(caseId)))
}
