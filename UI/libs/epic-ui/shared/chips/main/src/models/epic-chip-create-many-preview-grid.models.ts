import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicChipCreate } from 'epic-ui/api'
import { EpicAgGrid } from 'epic-ui/common/ag-grid'


export namespace EpicChipCreateManyPreviewGrid {

    export enum ColId {
        asicId = 'asicId',
        serialNumber = 'serialNumber',
        generalLocation = 'generalLocation',
    }

    export type RowEntity = EpicChipCreate

    export function getColDefs(): ColDef[] {
        return [
            {
                field: ColId.asicId,
                headerName: 'ASIC ID',
                flex: 1,
                minWidth: 200,
            },
            {
                field: ColId.serialNumber,
                headerName: 'Chip Serial No.',
                flex: 1,
                minWidth: 200,
            },
            {
                field: ColId.generalLocation,
                headerName: 'Location',
                flex: 1,
            },
        ]
    }

    export function getGridOptions(): GridOptions<RowEntity> {
        return {
            ...EpicAgGrid.getDefaultGridOptions<RowEntity>(),
            getRowId: (params) => {
                return params.data.asicId.toString()
            },
            domLayout: 'autoHeight',
            pagination: true,
            paginationPageSize: 10,
            rowSelection: undefined,
        }
    }

}
