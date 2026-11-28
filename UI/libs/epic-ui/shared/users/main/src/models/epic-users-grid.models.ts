import { ColDef, GridOptions } from 'ag-grid-community'
import { AgIconActionsCell, AgIconActionsCellComponent, EpicAgGrid } from 'epic-ui/common/ag-grid'
import { toEpicMatOutlinedIcon } from 'epic-ui/common/components'
import moment from 'moment'
import { EpicUser } from 'svt-ts-types'

import { EpicUsersRules } from './epic-users-rules.models'


export namespace EpicUsersGrid {

    export enum ColId {
        login = 'login',
        name = 'name',
        role = 'role',
        isActive = 'isActive',
        createdAt = 'createdAt',
        actions = 'actions',
    }

    export type RowEntity = EpicUser

    export enum CellEventEvent {
        Edit = 'Edit',
        SetPassword = 'SetPassword',
        SwitchOff = 'SwitchOff',
        SwitchOn = 'SwitchOn',
    }

    export type Options = {
        /** True for the row of the logged-in user: it cannot be switched off. Read when a row is drawn. */
        isOwnUser: (row: RowEntity) => boolean
    }

    /** The actions of a row: Edit, Set password, and Switch off (an active user) or Switch on (a user switched off). */
    export function getRowActions(row: RowEntity, isOwnUser: boolean): AgIconActionsCell.Action[] {
        const switchAction: AgIconActionsCell.Action = row.isActive
            ? {
                icon: toEpicMatOutlinedIcon('person_off'),
                tooltip: isOwnUser ? EpicUsersRules.OWN_USER_HINT : 'Switch off',
                disabled: isOwnUser,
                onClick: () => ({ eventName: CellEventEvent.SwitchOff }),
            }
            : {
                icon: toEpicMatOutlinedIcon('how_to_reg'),
                tooltip: 'Switch on',
                onClick: () => ({ eventName: CellEventEvent.SwitchOn }),
            }
        return [
            {
                icon: 'epic-pencil',
                tooltip: 'Edit',
                onClick: () => ({ eventName: CellEventEvent.Edit }),
            },
            {
                icon: toEpicMatOutlinedIcon('password'),
                tooltip: 'Set password',
                onClick: () => ({ eventName: CellEventEvent.SetPassword }),
            },
            switchAction,
        ]
    }

    export function getColDefs(options: Options): ColDef<RowEntity>[] {
        return [
            {
                field: ColId.login,
                headerName: 'Login',
                flex: 1,
                minWidth: 160,
            },
            {
                field: ColId.name,
                headerName: 'Name',
                flex: 1,
                minWidth: 200,
            },
            {
                field: ColId.role,
                headerName: 'Role',
                minWidth: 120,
            },
            {
                field: ColId.isActive,
                headerName: 'Active',
                minWidth: 150,
                // Text, not the checkbox that AG Grid draws for a boolean column by itself.
                cellDataType: false,
                valueFormatter: ({ value }) => (value ? 'Yes' : 'No (switched off)'),
            },
            {
                field: ColId.createdAt,
                headerName: 'Created',
                minWidth: 170,
                valueFormatter: ({ value }) => (value ? moment(value).format('DD.MM.YY - HH:mm:ss') : '-'),
            },
            {
                colId: ColId.actions,
                ...AgIconActionsCell.getCellSchema<RowEntity>({
                    actions: ({ rowData }) => getRowActions(rowData, options.isOwnUser(rowData)),
                }),
                width: AgIconActionsCell.getCellWidth(3),
                cellRenderer: AgIconActionsCellComponent,
            },
        ]
    }

    export function getGridOptions(): GridOptions<RowEntity> {
        return {
            ...EpicAgGrid.getDefaultGridOptions<RowEntity>(),
            rowSelection: undefined,
            getRowId: ({ data }) => data.id.toString(),
        }
    }

}
