import { EpicUser, EpicUserRole } from 'svt-ts-types'

import { EpicUsersGrid } from './epic-users-grid.models'
import { EpicUsersRules } from './epic-users-rules.models'

import Grid = EpicUsersGrid


const JANE: EpicUser = {
    id: 7,
    login: 'jane.doe',
    name: 'Jane Doe',
    role: EpicUserRole.Expert,
    isActive: true,
    createdAt: '2026-11-27T08:30:00.000Z',
}

describe('EpicUsersGrid', () => {

    it('has the columns Login, Name, Role, Active, Created and the row actions', () => {
        const colDefs = Grid.getColDefs({ isOwnUser: () => false })

        expect(colDefs.map((colDef) => colDef.headerName)).toEqual(['Login', 'Name', 'Role', 'Active', 'Created', ''])
        expect(colDefs.map((colDef) => colDef.field ?? colDef.colId))
            .toEqual(['login', 'name', 'role', 'isActive', 'createdAt', Grid.ColId.actions])
    })

    it('shows the state and the creation time as text', () => {
        const [, , , active, created] = Grid.getColDefs({ isOwnUser: () => false })
        type Formatter = (params: { value: unknown }) => string
        const format = (colDef: typeof active, value: unknown) => (colDef.valueFormatter as Formatter)({ value })

        expect(format(active, true)).toBe('Yes')
        expect(format(active, false)).toBe('No (switched off)')
        expect(format(created, JANE.createdAt)).toMatch(/^27\.11\.26 - \d\d:30:00$/)
        expect(format(created, null)).toBe('-')
    })

    it('offers Edit, Set password and Switch off for an active user', () => {
        const actions = Grid.getRowActions(JANE, false)

        expect(actions.map((action) => action.tooltip)).toEqual(['Edit', 'Set password', 'Switch off'])
        expect(actions.map((action) => action.onClick?.().eventName))
            .toEqual([Grid.CellEventEvent.Edit, Grid.CellEventEvent.SetPassword, Grid.CellEventEvent.SwitchOff])
        expect(actions.some((action) => action.disabled)).toBe(false)
    })

    it('offers Switch on for a user who is switched off', () => {
        const [, , switchAction] = Grid.getRowActions({ ...JANE, isActive: false }, false)

        expect(switchAction.tooltip).toBe('Switch on')
        expect(switchAction.onClick?.().eventName).toBe(Grid.CellEventEvent.SwitchOn)
        expect(switchAction.disabled).toBeFalsy()
    })

    it('disables Switch off in the own row, with the hint; Edit and Set password stay', () => {
        const [edit, password, switchAction] = Grid.getRowActions(JANE, true)

        expect(switchAction.disabled).toBe(true)
        expect(switchAction.tooltip).toBe(EpicUsersRules.OWN_USER_HINT)
        expect(edit.disabled).toBeFalsy()
        expect(password.disabled).toBeFalsy()
    })

    it('asks for the own row when a row is drawn', () => {
        const isOwnUser = vi.fn((row: EpicUser) => row.id === JANE.id)
        const actionsColDef = Grid.getColDefs({ isOwnUser }).at(-1)
        const actions = actionsColDef?.cellRendererParams.actions as (args: { rowData: EpicUser }) => ReturnType<typeof Grid.getRowActions>

        expect(actions({ rowData: JANE })[2].disabled).toBe(true)
        expect(actions({ rowData: { ...JANE, id: 8 } })[2].disabled).toBe(false)
        expect(isOwnUser).toHaveBeenCalledTimes(2)
    })

    it('identifies a row by the user id', () => {
        const getRowId = Grid.getGridOptions().getRowId as (params: { data: EpicUser }) => string

        expect(getRowId({ data: JANE })).toBe('7')
    })

})
