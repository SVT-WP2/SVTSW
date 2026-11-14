import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicAgGrid } from 'epic-ui/common/ag-grid'
import { EpicEquipmentType } from 'svt-ts-types'


export namespace EpicEquipmentTypesGrid {

    export enum ColId {
        id = 'id',
        name = 'name',
    }

    export type RowEntity = EpicEquipmentType

    export function getColDefs(): ColDef[] {
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
        ]
    }

    export function getGridOptions(): GridOptions<RowEntity> {
        return {
            ...EpicAgGrid.getDefaultGridOptions<RowEntity>(),
            rowSelection: undefined,
        }
    }

}
