import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicAgGrid } from 'epic-ui/common/ag-grid'


export namespace EpicWaferEnumsGrid {

    export enum ColId {
        name = 'name',
    }

    export type RowEntity = { name: string }

    export function getColDefs(): ColDef[] {
        return [
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
            getRowId: (params) => {
                return params.data.name
            },
        }
    }

}
