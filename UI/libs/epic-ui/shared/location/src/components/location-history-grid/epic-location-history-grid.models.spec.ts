import { ValueGetterFunc } from 'ag-grid-community'

import { EpicLocationHistoryGrid } from './epic-location-history-grid.models'

import Grid = EpicLocationHistoryGrid


const ROW: Grid.RowEntity = {
    id: 'row-1',
    generalLocation: 'CERN',
    date: '2026-03-01',
    note: 'moved to the lab',
    username: null,
    userName: 'Anna Rossi',
}

describe('EpicLocationHistoryGrid', () => {

    it('has the columns Location, Changed At, Note and Updated By', () => {
        const colDefs = Grid.getColDefs()

        expect(colDefs.map((colDef) => colDef.headerName)).toEqual(['Location', 'Changed At', 'Note', 'Updated By'])
        expect(colDefs.map((colDef) => colDef.field ?? colDef.colId)).toEqual(['generalLocation', 'date', 'note', Grid.ColId.updatedBy])
    })

    it('shows the name of the user who moved it', () => {
        expect(Grid.getUpdatedBy(ROW)).toBe('Anna Rossi')
        expect(Grid.getUpdatedBy({ ...ROW, username: 'free text' })).toBe('Anna Rossi')
    })

    it('falls back to the free text username for an old row without a user', () => {
        expect(Grid.getUpdatedBy({ ...ROW, userName: null, username: 'okorchak' })).toBe('okorchak')
        expect(Grid.getUpdatedBy({ ...ROW, userName: null, username: null })).toBeNull()
        expect(Grid.getUpdatedBy(undefined)).toBeNull()
    })

    it('reads the Updated By cell through that rule', () => {
        const updatedBy = Grid.getColDefs().find((colDef) => colDef.colId === Grid.ColId.updatedBy)
        const valueGetter = updatedBy?.valueGetter as ValueGetterFunc<Grid.RowEntity>
        const valueOf = (data: Grid.RowEntity) => valueGetter({ data } as Parameters<typeof valueGetter>[0])

        expect(valueOf(ROW)).toBe('Anna Rossi')
        expect(valueOf({ ...ROW, userName: null, username: 'okorchak' })).toBe('okorchak')
    })

})
