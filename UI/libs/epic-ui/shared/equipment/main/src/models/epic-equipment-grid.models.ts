import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicEquipment, EpicEquipmentType } from 'epic-ui/api'
import { AgIconActionsCell, AgIconActionsCellComponent, EpicAgGrid } from 'epic-ui/common/ag-grid'
import { toEpicMatOutlinedIcon } from 'epic-ui/common/components'


export namespace EpicEquipmentGrid {

    export enum ColId {
        id = 'id',
        name = 'name',
        equipmentTypeName = 'equipmentTypeName',
        generalLocation = 'generalLocation',
        specification = 'specification',
        actions = 'actions',
    }

    export type RowEntity =
        & EpicEquipment
        &
        {
            equipmentType?: EpicEquipmentType
        }

    export enum CellEventEvent {
        LocationHistory = 'LocationHistory',
        UpdateLocation = 'UpdateLocation',
    }

    export function getColDefs(): ColDef<RowEntity>[] {
        return [
            {
                field: ColId.id,
                headerName: 'ID',
                flex: 1,
                minWidth: 80,
            },
            {
                field: ColId.name,
                headerName: 'Name',
                flex: 1,
                minWidth: 200,
            },
            {
                colId: ColId.equipmentTypeName,
                headerName: 'Type',
                flex: 1,
                minWidth: 200,
                valueGetter: ({ data }) => data?.equipmentType?.name,
            },
            {
                field: ColId.generalLocation,
                headerName: 'Location',
                flex: 1,
                minWidth: 200,
            },
            {
                field: ColId.specification,
                headerName: 'Specification',
                flex: 1,
                minWidth: 200,
            },
            {
                colId: ColId.actions,
                ...AgIconActionsCell.getCellSchema<RowEntity>({
                    actions: ({ rowData }) => [
                        AgIconActionsCell.getMoreAction([
                            {
                                icon: 'history',
                                title: 'Location History',
                                onClick: () => ({
                                    eventName: CellEventEvent.LocationHistory,
                                }),
                            },
                            {
                                icon: toEpicMatOutlinedIcon('location_on'),
                                title: 'Update Location',
                                onClick: () => ({
                                    eventName: CellEventEvent.UpdateLocation,
                                }),
                            },
                        ]),
                    ],
                }),
                width: AgIconActionsCell.getCellWidth(1),
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
