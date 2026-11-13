import { ColDef, GridOptions } from 'ag-grid-community'
import { EpicWpProbeCard } from 'epic-api-types'
import { AgIconActionsCell, AgIconActionsCellComponent, EpicAgGrid } from 'epic-ui/common/ag-grid'


export namespace EpicWpProbeCardsGrid {

    export enum ColId {
        id = 'id',
        name = 'name',
        serialNumber = 'serialNumber',
        model = 'model',
        arriveDate = 'arriveDate',
        location = 'location',
        type = 'type',
        vendor = 'vendor',
        vendorCleaningInterval = 'vendorCleaningInterval',
        actions = 'actions',
    }

    export type RowEntity = EpicWpProbeCard

    export enum CellEventEvent {
        Details = 'Details',
    }

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
            {
                field: ColId.serialNumber,
                headerName: 'Serial Number',
                flex: 1,
                minWidth: 100,
            },
            {
                field: ColId.model,
                headerName: 'Model',
            },
            {
                field: ColId.arriveDate,
                headerName: 'Arrive On',
                minWidth: 120,
            },
            {
                field: ColId.location,
                headerName: 'Location',
            },
            {
                field: ColId.type,
                headerName: 'Type',
                minWidth: 120,
            },
            {
                field: ColId.vendor,
                headerName: 'Vendor',
                minWidth: 120,
            },
            {
                field: ColId.vendorCleaningInterval,
                headerName: 'Cleaning Interval',
                minWidth: 120,
            },
            {
                colId: ColId.actions,
                ...AgIconActionsCell.getCellSchema<RowEntity>({
                    // Read-only: the Kafka contract has no CreateProbeCard / UpdateProbeCard operation.
                    actions: () => [
                        {
                            icon: 'epic-eye-open',
                            tooltip: 'Details',
                            onClick: () => ({
                                eventName: CellEventEvent.Details,
                            }),
                        },
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
            getRowId: (params) => {
                return params.data.id.toString()
            },
        }
    }

}
