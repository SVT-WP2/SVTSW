import { EpicSvtDutEntityName, EpicSvtTest, EpicSvtTestStatus } from 'svt-ts-types'

import { EpicSvtTestsGrid } from './epic-svt-tests-grid.models'

import Grid = EpicSvtTestsGrid


const TEST: EpicSvtTest = {
    id: 7,
    dutEntityName: EpicSvtDutEntityName.Chip,
    dutId: 3,
    testTypeConfigId: 1,
    testSetupConfigId: 1,
    createdAt: '2026-11-27T08:30:00.000Z',
    startedAt: null,
    finishedAt: null,
    pathToResult: null,
    testResultStatus: null,
    status: EpicSvtTestStatus.Pending,
    createdByUserId: 4,
    createdByUserName: 'Anna Rossi',
}

const NO_RELATIONS: Grid.RowEntityRelations = { testSetupConfigs: [], testSetups: [], testTypeConfigs: [], testTypes: [] }

describe('EpicSvtTestsGrid', () => {

    it('has a column Created By with the name of the user who created the test, right after Created At', () => {
        const headers = Grid.getColDefs().map((colDef) => colDef.headerName)
        const createdBy = Grid.getColDefs().find((colDef) => colDef.headerName === 'Created By')

        expect(headers.indexOf('Created By')).toBe(headers.indexOf('Created At') + 1)
        expect(createdBy?.field).toBe('createdByUserName')
    })

    it('shows the name, and a dash for a test without a user', () => {
        const createdBy = Grid.getColDefs().find((colDef) => colDef.field === Grid.ColId.createdBy)
        const format = (value: unknown) => (createdBy?.valueFormatter as (params: { value: unknown }) => string)({ value })

        expect(format('Anna Rossi')).toBe('Anna Rossi')
        expect(format(null)).toBe('-')
        expect(format(undefined)).toBe('-')
    })

    it('keeps the creator of the test on its row', () => {
        const [row] = Grid.toRowEntities([TEST], NO_RELATIONS)

        expect(row).toMatchObject({ createdByUserId: 4, createdByUserName: 'Anna Rossi' })
    })

    it('leaves the column out on request, as the other columns', () => {
        const fields = Grid.getColDefs({ excludeColIds: [Grid.ColId.createdBy] }).map((colDef) => colDef.field ?? colDef.colId)

        expect(fields).not.toContain(Grid.ColId.createdBy)
        expect(fields).toContain(Grid.ColId.createdAt)
    })

})
