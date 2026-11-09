import { ParityHeaderOverrides } from './parity-client'


/**
 * One request of the parity suite. The id is stable across recordings (`<group>/<name>`): the snapshots, the
 * known-differences list and the report key on it.
 */
export type ParityCase = {
    id: string
    /** The record value exactly as sent: JSON for every case but the malformed ones. */
    value: string
    headers?: ParityHeaderOverrides
    /**
     * How `data.items` compares: `ordered` where the C++ orders the list (`ORDER BY id` on every entity table),
     * `set` where it does not (relation and history lists, `docs/db-agent-clone/03-parity-testing.md` §3).
     */
    items: 'ordered' | 'set'
    /** Keys whose values depend on the moment of the run (`createdAt` from `now()`): blanked before comparing. */
    volatileKeys?: string[]
    note?: string
}

type ListFilterCase = {
    name: string
    match: Record<string, unknown>
    noMatch: Record<string, unknown>
}

type ListCasesOptions = {
    /** Two existing ids: one for the single-id filter, both for the several-ids filter. */
    existingIds: [number, number]
    /** The declared filters of the entity, each with a matching and a non-matching value. */
    filters?: ListFilterCase[]
    /** A filter the pager cases carry, to keep a big list small (`waferId` for ASICs). */
    pagerBase?: Record<string, unknown>
    /** Page size for the pager cases, and the total of `pagerBase` to compute the offset beyond the end. */
    pageSize: number
    pagerTotal: number
    volatileKeys?: string[]
}

const MISSING_ID = 999999

/** Dates of the dev dump never reach these bounds; the created-at range of the two existing tests is Aug–Sep 2026. */
const DATE_IN_RANGE = '2026-09-01T00:00:00Z'
const DATE_BEYOND = '2030-01-01T00:00:00Z'

/** The smallest valid wafer map: one group with one MOSAIX ASIC. The same map the broker-backed e2e spec creates. */
export const SMALL_WAFER_MAP = JSON.stringify({
    Groups: { Group_0: [{ PosInGroup: 0, FamilyType: 'MOSAIX' }] },
    MapGroups: {
        MapGroupsRow0: {
            MapGroupsColumns: [{
                GroupName: 'Group_0',
                ExistingAsics: ['All'],
                MechanicallyDamagedASICs: [],
                ASICsCoveredByGreenLayer: [],
                MechanicallyIntegerASICs: [0],
            }],
        },
    },
})

const CONFIG_BODY = JSON.stringify({ boards: [{ number: 0, type: 'enclustra' }], parity: true }, null, 2)

function request(id: string, type: string, data: unknown, options: Partial<ParityCase> = {}): ParityCase {
    return { id, value: JSON.stringify(data === undefined ? { type } : { type, data }), items: 'ordered', ...options }
}

/**
 * The read matrix of `03-parity-testing.md` §4.1 for one `GetAll*` type: no filter, `ids` for one and several
 * ids, a missing id, the declared filters matching and not, an undeclared key, `null`, `true`, `[]` and a
 * mixed-type array as filter values, and the pager at the start, the second page, beyond the end and with a
 * `null` limit.
 */
function listCases(group: string, type: string, options: ListCasesOptions): ParityCase[] {
    const [one, two] = options.existingIds
    const list = (name: string, data: unknown): ParityCase =>
        request(`${group}/${name}`, type, data, { volatileKeys: options.volatileKeys })
    const base = options.pagerBase ?? {}
    const cases = [
        list('all', {}),
        list('filter-ids-one', { filter: { ids: [one] } }),
        list('filter-ids-several', { filter: { ids: [one, two] } }),
        list('filter-ids-missing', { filter: { ids: [MISSING_ID] } }),
        list('filter-ids-empty', { filter: { ids: [] } }),
        list('filter-ids-null', { filter: { ids: null } }),
        list('filter-ids-true', { filter: { ids: true } }),
        list('filter-ids-mixed', { filter: { ids: [one, 'x'] } }),
        list('filter-unknown-key', { filter: { notAFilter: 1 } }),
        list('filter-null', { filter: null }),
    ]
    for (const filter of options.filters ?? []) {
        cases.push(list(`filter-${filter.name}-match`, { filter: filter.match }))
        cases.push(list(`filter-${filter.name}-no-match`, { filter: filter.noMatch }))
    }
    cases.push(
        list('pager-first', { filter: base, pager: { limit: options.pageSize, offset: 0 } }),
        list('pager-second', { filter: base, pager: { limit: options.pageSize, offset: options.pageSize } }),
        list('pager-beyond', { filter: base, pager: { limit: options.pageSize, offset: options.pagerTotal + 5 } }),
        list('pager-limit-null', { filter: base, pager: { limit: null, offset: 0 } }),
        list('pager-offset-only', { filter: base, pager: { offset: 0 } }),
    )
    return cases
}

// ── 1. Reads over the dev dump (2026-11-08) ─────────────────────────────────────────────────────────────────

const READ_CASES: ParityCase[] = [
    ...listCases('wafer-types', 'GetAllWaferTypes', { existingIds: [1, 3], pageSize: 2, pagerTotal: 3 }),
    ...listCases('wafers', 'GetAllWafers', { existingIds: [1, 4], pageSize: 5, pagerTotal: 15 }),
    ...listCases('asics', 'GetAllAsics', {
        existingIds: [1, 8051],
        filters: [
            { name: 'waferId', match: { waferId: 3 }, noMatch: { waferId: MISSING_ID } },
            { name: 'chipId', match: { chipId: 1 }, noMatch: { chipId: MISSING_ID } },
            { name: 'serialNumber', match: { serialNumber: 'ER1-W1_0_0' }, noMatch: { serialNumber: 'no-such-asic' } },
            { name: 'familyTypes', match: { waferId: 1, familyTypes: ['BABYMOSS'] }, noMatch: { waferId: 1, familyTypes: ['NKF5'] } },
            {
                name: 'quality',
                match: { waferId: 3, quality: 'MechanicallyInteger' },
                noMatch: { waferId: 3, quality: 'MechanicallyDamaged' },
            },
        ],
        pagerBase: { waferId: 2 },
        pageSize: 5,
        pagerTotal: 3421,
    }),
    ...listCases('chip-blocks', 'GetAllBlocks', {
        existingIds: [1, 3],
        filters: [
            { name: 'chipId', match: { chipId: 1 }, noMatch: { chipId: MISSING_ID } },
            { name: 'chipBlockTypes', match: { chipBlockTypes: ['AncMPW2_SLDO'] }, noMatch: { chipBlockTypes: ['AncMPW1_SLDO'] } },
            { name: 'serialNumber', match: { serialNumber: 'SLDO_AncMPW2-W1_0_0' }, noMatch: { serialNumber: 'no-such-block' } },
        ],
        pageSize: 2,
        pagerTotal: 3,
    }),
    ...listCases('chips', 'GetAllChips', {
        existingIds: [1, 1],
        filters: [
            { name: 'generalLocation', match: { generalLocation: 'Brunel' }, noMatch: { generalLocation: 'CERN' } },
            { name: 'serialNumber', match: { serialNumber: 'AncMPW2-W1_0_0' }, noMatch: { serialNumber: 'no-such-chip' } },
            { name: 'familyTypes', match: { familyTypes: ['AncMPW2'] }, noMatch: { familyTypes: ['NKF7'] } },
        ],
        pageSize: 1,
        pagerTotal: 1,
    }),
    ...listCases('equipment-types', 'GetAllEquipmentTypes', { existingIds: [1, 3], pageSize: 2, pagerTotal: 3 }),
    ...listCases('equipment', 'GetAllEquipment', { existingIds: [1, 2], pageSize: 1, pagerTotal: 2 }),
    ...listCases('wp-machines', 'GetAllWaferProbeMachines', { existingIds: [1, 2], pageSize: 1, pagerTotal: 2 }),
    ...listCases('wp-probe-cards', 'GetAllProbeCards', { existingIds: [1, 2], pageSize: 1, pagerTotal: 2 }),
    ...listCases('wp-projects', 'GetAllWaferProbeProjects', { existingIds: [1, 11], pageSize: 4, pagerTotal: 11 }),
    ...listCases('svt-test-setups', 'GetAllSvtTestSetups', { existingIds: [1, 3], pageSize: 2, pagerTotal: 3 }),
    ...listCases('svt-test-setup-configs', 'GetAllSvtTestSetupConfigs', {
        existingIds: [1, 3],
        filters: [{ name: 'setupId', match: { setupId: 1 }, noMatch: { setupId: MISSING_ID } }],
        pageSize: 2,
        pagerTotal: 3,
    }),
    ...listCases('svt-test-types', 'GetAllSvtTestTypes', {
        existingIds: [1, 5],
        filters: [{ name: 'dutTypes', match: { dutTypes: ['AncMPW2_SLDO'] }, noMatch: { dutTypes: ['NKF7'] } }],
        pageSize: 2,
        pagerTotal: 5,
    }),
    ...listCases('svt-test-type-configs', 'GetAllSvtTestTypeConfigs', {
        existingIds: [1, 22],
        filters: [{ name: 'testTypeId', match: { testTypeId: 3 }, noMatch: { testTypeId: MISSING_ID } }],
        pageSize: 10,
        pagerTotal: 22,
    }),
    ...listCases('svt-test-templates', 'GetAllSvtTestTemplates', {
        existingIds: [1, 6],
        filters: [{ name: 'dutTypes', match: { dutTypes: ['BABYMOSAIX'] }, noMatch: { dutTypes: ['AncMPW2_SLDO'] } }],
        pageSize: 4,
        pagerTotal: 6,
    }),
    ...listCases('svt-tests', 'GetAllSvtTests', {
        existingIds: [1, 2],
        filters: [
            { name: 'dutEntityNames', match: { dutEntityNames: ['Asic'] }, noMatch: { dutEntityNames: ['Chip'] } },
            { name: 'dutId', match: { dutId: 1 }, noMatch: { dutId: MISSING_ID } },
            { name: 'testResultStatuses', match: { testResultStatuses: [null] }, noMatch: { testResultStatuses: ['SUCCESS'] } },
            { name: 'testTypeConfigIds', match: { testTypeConfigIds: [1] }, noMatch: { testTypeConfigIds: [MISSING_ID] } },
            { name: 'testSetupConfigIds', match: { testSetupConfigIds: [1] }, noMatch: { testSetupConfigIds: [MISSING_ID] } },
            { name: 'createdAtFrom', match: { createdAtFrom: DATE_IN_RANGE }, noMatch: { createdAtFrom: DATE_BEYOND } },
            { name: 'createdAtTo', match: { createdAtTo: DATE_BEYOND }, noMatch: { createdAtTo: DATE_IN_RANGE } },
            { name: 'startedAtFrom', match: { startedAtFrom: DATE_IN_RANGE }, noMatch: { startedAtFrom: DATE_BEYOND } },
            { name: 'finishedAtTo', match: { finishedAtTo: DATE_BEYOND }, noMatch: { finishedAtTo: DATE_IN_RANGE } },
        ],
        pageSize: 1,
        pagerTotal: 2,
    }),

    // §4.9 enums: every spelling of the names key, an unknown name, an empty list
    request('enums/all', 'GetAllEnums', {}),
    request('enums/filter-enumNames', 'GetAllEnums', { filter: { enumNames: ['dutType', 'wpVendor'] } }),
    request('enums/data-enumNames', 'GetAllEnums', { enumNames: ['dutType', 'wpVendor'] }),
    request('enums/data-enumsNames', 'GetAllEnums', { enumsNames: ['dutType', 'wpVendor'] }),
    request('enums/unknown-name', 'GetAllEnums', { filter: { enumNames: ['notAnEnum'] } }),
    request('enums/empty-list', 'GetAllEnums', { filter: { enumNames: [] } }),

    // location histories, maps and config bodies of existing rows and of a missing id
    request('wafers/location-history', 'GetWaferLocationHistory', { waferId: 1 }, { items: 'set' }),
    request('wafers/location-history-missing', 'GetWaferLocationHistory', { waferId: MISSING_ID }, { items: 'set' }),
    request('chips/location-history', 'GetChipLocationHistory', { chipId: 1 }, { items: 'set' }),
    request('equipment/location-history', 'GetEquipmentLocationHistory', { equipmentId: 1 }, { items: 'set' }),
    request('wafer-types/map', 'GetWaferTypeMap', { waferTypeId: 3 }),
    request('wafer-types/map-missing', 'GetWaferTypeMap', { waferTypeId: MISSING_ID }),
    request('svt-test-setup-configs/body', 'GetSvtTestSetupConfigBody', { id: 1 }),
    request('svt-test-setup-configs/body-missing', 'GetSvtTestSetupConfigBody', { id: MISSING_ID }),
    request('svt-test-type-configs/body', 'GetSvtTestTypeConfigBody', { id: 1 }),
    request('svt-test-type-configs/body-missing', 'GetSvtTestTypeConfigBody', { id: MISSING_ID }),
]

// ── 2. Write flows, in an order that keeps both databases on the same ids ────────────────────────────────────
//
// Both agents start from the same dump, so a create that succeeds on both gets the same id on both. Bodies
// use the shape both accept (every optional key present, `null` where the contract allows it; the extra
// top-level keys the C++ demands, D-7 and D-8). Requests expected to succeed on one agent only come last (§3).

const WAFER_CREATE = (serialNumber: string, waferTypeId: number): Record<string, unknown> => ({
    serialNumber,
    batchNumber: 1,
    thinningDate: null,
    dicingDate: null,
    productionDate: '2026-01-15',
    waferTypeId,
    generalLocation: 'CERN',
})

const MANY_CHIPS = [{ serialNumber: 'PARITY-CHIP-2', asicId: 2 }, { serialNumber: 'PARITY-CHIP-3', asicId: 3 }]

const UNLOAD_WAFER = { wpMachineId: 3, loadedWaferId: null, loadedWaferOrientation: null }

const VOLATILE_CREATED_AT: Partial<ParityCase> = { volatileKeys: ['createdAt'] }

const WRITE_CASES: ParityCase[] = [
    // wafer type 4 and its map (D-7: the C++ needs data.waferMap next to data.create.waferMap)
    // (`engineeringRun` is unique on WaferType; ER3 and LAS1 are the enum values the dump does not use)
    request('flow/wafer-type-create', 'CreateWaferType', {
        create: { name: 'ParityType', engineeringRun: 'ER3', foundry: 'Xfab', technology: 'TPSCo65', waferMap: SMALL_WAFER_MAP },
        waferMap: SMALL_WAFER_MAP,
    }),
    request('flow/wafer-type-map', 'GetWaferTypeMap', { waferTypeId: 4 }),
    request('flow/wafer-type-list', 'GetAllWaferTypes', { filter: { ids: [4] } }),

    // §4.4: one wafer per stored map; the generated ASIC sets are compared in full (digested above 200 rows)
    request('flow/wafer-create-er1', 'CreateWafer', { create: WAFER_CREATE('PARITY-ER1-W1', 1) }),
    request('flow/wafer-create-er2', 'CreateWafer', { create: WAFER_CREATE('PARITY-ER2-W1', 2) }),
    request('flow/wafer-create-ancmpw2', 'CreateWafer', { create: WAFER_CREATE('PARITY-AncMPW2-W1', 3) }),
    request('flow/wafer-create-duplicate', 'CreateWafer', { create: WAFER_CREATE('ER1-W1', 1) }),
    request('flow/wafer-asics-er1', 'GetAllAsics', { filter: { waferId: 16 } }),
    request('flow/wafer-asics-er2', 'GetAllAsics', { filter: { waferId: 17 } }),
    request('flow/wafer-asics-ancmpw2', 'GetAllAsics', { filter: { waferId: 18 } }),
    request('flow/wafer-list-created', 'GetAllWafers', { filter: { ids: [16, 17, 18] } }),
    request('flow/wafer-location-at-creation', 'GetWaferLocationHistory', { waferId: 16 }, { items: 'set' }),

    // §4.3 generic update: existing id, empty update, missing id, location through the generic update, a null
    request('flow/wafer-update', 'UpdateWafer', { id: 16, update: { thinningDate: '2026-02-02' } }),
    request('flow/wafer-update-empty', 'UpdateWafer', { id: 16, update: {} }),
    request('flow/wafer-update-missing', 'UpdateWafer', { id: MISSING_ID, update: { thinningDate: '2026-02-02' } }),
    request('flow/wafer-update-location-rejected', 'UpdateWafer', { id: 16, update: { generalLocation: 'Brunel' } }),
    request('flow/wafer-update-null', 'UpdateWafer', { id: 16, update: { dicingDate: null } }),

    // §4.6 two moves on one day, then the entity's current location and its history
    request('flow/wafer-move-1', 'UpdateWaferLocation', {
        waferId: 16, generalLocation: 'Brunel', date: '2026-11-09', username: 'parity', note: 'first move',
    }),
    request('flow/wafer-move-2', 'UpdateWaferLocation', {
        waferId: 16, generalLocation: 'Prague', date: '2026-11-09', username: 'parity', note: 'second move, same day',
    }),
    request('flow/wafer-after-moves', 'GetAllWafers', { filter: { ids: [16] } }),
    request('flow/wafer-history-after-moves', 'GetWaferLocationHistory', { waferId: 16 }, { items: 'set' }),

    // ASIC and chips
    request('flow/asic-create', 'CreateAsic', {
        create: {
            serialNumber: 'PARITY-ASIC-1', waferId: 18, familyType: 'AncMPW2', waferMapPosition: '9_9', quality: 'MechanicallyInteger',
        },
    }),
    request('flow/asic-created', 'GetAllAsics', { filter: { serialNumber: 'PARITY-ASIC-1' } }),
    request('flow/chip-create', 'CreateChip', { create: { serialNumber: 'PARITY-CHIP-1', asicId: 1, generalLocation: 'CERN' } }),
    request('flow/chip-created', 'GetAllChips', { filter: { ids: [2] } }),
    request('flow/chip-location-at-creation', 'GetChipLocationHistory', { chipId: 2 }, { items: 'set' }),
    request('flow/chip-move', 'UpdateChipLocation', {
        chipId: 2, generalLocation: 'Brunel', date: '2026-11-09', username: 'parity', note: 'moved',
    }),
    request('flow/chip-after-move', 'GetAllChips', { filter: { serialNumber: 'PARITY-CHIP-1' } }),
    request('flow/chips-create-many', 'CreateManyChips', {
        create: { generalLocation: 'CERN', items: MANY_CHIPS },
        items: MANY_CHIPS,
    }),
    request('flow/chips-after-create-many', 'GetAllChips', {}),

    // equipment
    request('flow/equipment-type-create', 'CreateEquipmentType', { create: { name: 'Parity Equipment Type' } }),
    request('flow/equipment-create', 'CreateEquipment', {
        create: { name: 'PARITY-EQ-1', equipmentTypeId: 4, generalLocation: 'CERN', specification: '{}' },
    }),
    request('flow/equipment-location-at-creation', 'GetEquipmentLocationHistory', { equipmentId: 3 }, { items: 'set' }),
    request('flow/equipment-move', 'UpdateEquipmentLocation', {
        equipmentId: 3, generalLocation: 'RAL', date: '2026-11-09', username: 'parity', note: 'moved',
    }),
    request('flow/equipment-after-move', 'GetAllEquipment', { filter: { ids: [3] } }),

    // §4.5 wafer-probe machine: load, swap, unload, unload when empty, load without orientation; install, replace
    request('flow/wp-machine-create', 'CreateWaferProbeMachine', {
        create: {
            name: 'PARITY-WPM', serialNumber: 'PARITY-SN', hostName: 'parity.cern.ch', connectionType: 'TCPIP', connectionPort: 35555,
            generalLocation: 'CERN', software: 'Sentio', swVersion: '26.1', vendor: 'MPI',
        },
    }),
    request('flow/wp-machine-update', 'UpdateWaferProbeMachine', {
        id: 3,
        update: {
            hostName: 'parity2.cern.ch', connectionType: 'TCPIP', connectionPort: 35556, generalLocation: 'Prague',
            software: 'Sentio', swVersion: '26.2',
        },
    }),
    request('flow/wp-machine-load', 'UpdateWpMachineLoadedWafer', { wpMachineId: 3, loadedWaferId: 16, loadedWaferOrientation: 'North' }),
    request('flow/wp-machine-swap', 'UpdateWpMachineLoadedWafer', { wpMachineId: 3, loadedWaferId: 17, loadedWaferOrientation: 'East' }),
    request('flow/wp-machine-unload', 'UpdateWpMachineLoadedWafer', UNLOAD_WAFER),
    request('flow/wp-machine-unload-empty', 'UpdateWpMachineLoadedWafer', UNLOAD_WAFER),
    request('flow/wp-machine-load-no-orientation', 'UpdateWpMachineLoadedWafer', { wpMachineId: 3, loadedWaferId: 18 }),
    request('flow/wp-machine-unload-again', 'UpdateWpMachineLoadedWafer', UNLOAD_WAFER),
    request('flow/wp-machine-install', 'UpdateWpMachineInstalledProbeCard', {
        wpMachineId: 3, installedProbeCardId: 1, installedProbeCardOrientation: 'East',
    }),
    request('flow/wp-machine-replace', 'UpdateWpMachineInstalledProbeCard', {
        wpMachineId: 3, installedProbeCardId: 2, installedProbeCardOrientation: 'West',
    }),
    request('flow/wp-machine-after', 'GetAllWaferProbeMachines', { filter: { ids: [3] } }),
    request('flow/wp-project-create', 'CreateWaferProbeProject', {
        create: {
            wpMachineId: 3, waferTypeId: 2, name: 'PARITY-PROJECT', asicFamilyType: 'MOSAIX', orientation: 'East',
            alignmentDie: '2,2', homeDie: '4,2', local2GlobalMap: '[]',
        },
    }),
    request('flow/wp-project-created', 'GetAllWaferProbeProjects', { filter: { ids: [12] } }),

    // §4.7 test flows
    request('flow/test-type-create', 'CreateSvtTestType', {
        create: {
            name: 'Parity Test Type',
            dutTypes: ['MOSAIX'],
            testTypeConfig: { name: 'parity type config', configBody: CONFIG_BODY, note: 'created by the parity run' },
        },
    }),
    request('flow/test-type-created', 'GetAllSvtTestTypes', { filter: { ids: [6] } }),
    request('flow/test-type-configs-created', 'GetAllSvtTestTypeConfigs', { filter: { testTypeId: 6 } }, VOLATILE_CREATED_AT),
    request('flow/test-type-config-create', 'CreateSvtTestTypeConfig', {
        create: { testTypeId: 6, name: 'parity type config 2', configBody: CONFIG_BODY, note: null },
    }, VOLATILE_CREATED_AT),
    request('flow/test-type-config-body', 'GetSvtTestTypeConfigBody', { id: 24 }),
    request('flow/test-setup-create', 'CreateSvtTestSetup', {
        create: {
            name: 'parity_setup',
            generalLocation: 'CERN',
            defaultConfig: { name: 'parity_setup_config_v0', configBody: CONFIG_BODY, note: 'default config' },
        },
    }),
    request('flow/test-setup-created', 'GetAllSvtTestSetups', { filter: { ids: [4] } }),
    request('flow/test-setup-config-create', 'CreateSvtTestSetupConfig', {
        create: { setupId: 4, name: 'parity_setup_config_v1', configBody: CONFIG_BODY, note: null },
    }, VOLATILE_CREATED_AT),
    request('flow/test-setup-config-body', 'GetSvtTestSetupConfigBody', { id: 5 }),
    request('flow/test-setup-update-default', 'UpdateSvtTestSetup', { id: 4, update: { defaultConfigId: 5 } }),
    request('flow/test-setup-configs-created', 'GetAllSvtTestSetupConfigs', { filter: { setupId: 4 } }, VOLATILE_CREATED_AT),
    request('flow/test-template-create-disabled', 'CreateSvtTestTemplate', {
        create: { dutType: 'MOSAIX', testTypeConfigId: 24, isEnabled: false },
    }),
    request('flow/test-template-created', 'GetAllSvtTestTemplates', { filter: { ids: [7] } }),
    request('flow/test-template-enable', 'UpdateSvtTestTemplate', { id: 7, update: { isEnabled: true } }),
    request('flow/test-create', 'CreateSvtTest', {
        create: { dutEntityName: 'Asic', dutId: 1, testTypeConfigId: 24, testSetupConfigId: 5 },
    }, VOLATILE_CREATED_AT),
    request('flow/test-start', 'UpdateSvtTestStart', { id: 3, update: { startedAt: '2026-11-09T10:00:00Z' } }, VOLATILE_CREATED_AT),
    request('flow/test-finish', 'UpdateSvtTestFinish', {
        id: 3,
        update: { finishedAt: '2026-11-09T10:05:00Z', pathToResult: '/results/parity/3', testResultStatus: 'SUCCESS' },
    }, VOLATILE_CREATED_AT),
    request('flow/test-created', 'GetAllSvtTests', { filter: { ids: [3] } }, VOLATILE_CREATED_AT),
    request('flow/tests-by-status', 'GetAllSvtTests', { filter: { testResultStatuses: ['SUCCESS'] } }, VOLATILE_CREATED_AT),
    request('flow/tests-by-started-from', 'GetAllSvtTests', { filter: { startedAtFrom: '2026-11-09T00:00:00Z' } }, VOLATILE_CREATED_AT),
    // D-1: the contract's shape and the shape the C++ reads
    request('flow/test-type-update-contract-shape', 'UpdateSvtTestType', { id: 6, update: { dutTypes: ['MOSAIX', 'BABYMOSAIX'] } }),
    request('flow/test-type-update-code-shape', 'UpdateSvtTestType', { testTypeId: 6, dutTypes: ['MOSAIX', 'BABYMOSAIX'] }),
    request('flow/test-type-after-updates', 'GetAllSvtTestTypes', { filter: { ids: [6] } }),
]

// ── 3. Requests the two agents are expected to answer differently (contract shape vs C++ requirement) ─────────

const DIVERGENT_CASES: ParityCase[] = [
    request('contract/wafer-type-create-contract-shape', 'CreateWaferType', {
        create: {
            name: 'ParityContractType', engineeringRun: 'LAS1', foundry: 'Xfab', technology: 'TPSCo65', waferMap: SMALL_WAFER_MAP,
        },
    }, { note: 'D-7: no data.waferMap next to data.create' }),
    request('contract/wafer-create-optional-keys-omitted', 'CreateWafer', {
        create: { serialNumber: 'PARITY-OPTIONAL', batchNumber: 2, waferTypeId: 3, generalLocation: 'CERN' },
    }, { note: 'D-9: the optional dates left out' }),
    request('contract/wafer-create-quote-in-serial', 'CreateWafer', {
        create: WAFER_CREATE('PARITY-O\'BRIEN', 3),
    }, { note: 'X-2: a single quote in a string value' }),
    request('contract/equipment-create-without-specification', 'CreateEquipment', {
        create: { name: 'PARITY-EQ-2', equipmentTypeId: 4, generalLocation: 'CERN' },
    }, { note: 'D-10: optional key left out' }),
    request('contract/chips-create-many-contract-shape', 'CreateManyChips', {
        create: { generalLocation: 'CERN', items: [{ serialNumber: 'PARITY-CHIP-4', asicId: 4 }] },
    }, { note: 'D-8: no data.items next to data.create.items' }),
    request('contract/wafer-move-without-date', 'UpdateWaferLocation', {
        waferId: 17, generalLocation: 'RAL', note: 'no date, no username',
    }, { note: 'D-11: nullable keys left out' }),
    request('contract/wp-machine-uninstall', 'UpdateWpMachineInstalledProbeCard', {
        wpMachineId: 3, installedProbeCardId: null, installedProbeCardOrientation: null,
    }, { note: 'D-13: uninstall' }),
    request('contract/wp-machine-after-uninstall', 'GetAllWaferProbeMachines', { filter: { ids: [3] } }),
    request('contract/test-setup-config-object-body', 'CreateSvtTestSetupConfig', {
        create: { setupId: 4, name: 'parity object body', configBody: { parity: 'object' }, note: null },
    }, { ...VOLATILE_CREATED_AT, note: 'R-7: a JSON field sent as an object' }),
    request('contract/wp-project-object-map', 'CreateWaferProbeProject', {
        create: {
            wpMachineId: 3, waferTypeId: 2, name: 'PARITY-PROJECT-OBJECT', asicFamilyType: 'MOSAIX', orientation: 'East',
            alignmentDie: '2,2', homeDie: '4,2', local2GlobalMap: [{ chip_name: 'parity' }],
        },
    }, { note: 'R-7: a JSON field sent as an array' }),
    request('contract/get-all-chip-blocks-contract-name', 'GetAllChipBlocks', {}, {
        note: 'the contract name; the BFF sends GetAllBlocks',
    }),
]

// ── 4. Envelope (§4.8), last: some of these end the C++ process ──────────────────────────────────────────────

const ENVELOPE_CASES: ParityCase[] = [
    request('envelope/missing-correlation-id', 'GetAllWaferTypes', {}, { headers: { kafka_correlationId: false } }),
    request('envelope/missing-reply-partition', 'GetAllWaferTypes', {}, { headers: { kafka_replyPartition: false } }),
    request('envelope/missing-reply-topic', 'GetAllWaferTypes', {}, { headers: { kafka_replyTopic: false } }),
    request('envelope/empty-type', '', {}),
    request('envelope/unknown-type', 'DoesNotExist', {}),
    request('envelope/no-data', 'GetAllWaferTypes', undefined),
    { id: 'envelope/no-type', value: JSON.stringify({ data: {} }), items: 'ordered' },
    { id: 'envelope/non-string-type', value: JSON.stringify({ type: 5, data: {} }), items: 'ordered' },
    { id: 'envelope/not-json', value: 'this is not json', items: 'ordered' },
    request('envelope/serving-afterwards', 'GetAllWaferTypes', { filter: { ids: [1] } }),
]

export const PARITY_CASES: ParityCase[] = [...READ_CASES, ...WRITE_CASES, ...DIVERGENT_CASES, ...ENVELOPE_CASES]

export function findParityCase(id: string): ParityCase | undefined {
    return PARITY_CASES.find((parityCase) => parityCase.id === id)
}
