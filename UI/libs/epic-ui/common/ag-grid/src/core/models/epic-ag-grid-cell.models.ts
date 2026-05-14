import { ColDef, GridApi, IRowNode } from 'ag-grid-community'
import { isFunction } from 'lodash-es'

import { EpicAgGridFilter } from './epic-ag-grid-filter.models'


export namespace EpicAgGridCell {

    export const CELL_WRAP_NO_PADDING_CLASS = 'epic-ag-cell-container--no-padding'

    export enum DefaultCellType {
        numericColumn = 'numericColumn',
        dateTimeColumn = 'dateTimeColumn',
    }

    export function getNumberCell(): Partial<ColDef> {
        return {
            type: DefaultCellType.numericColumn,
            ...EpicAgGridFilter.getCommonNumberFilter(),
            width: 150,
            enableValue: true,
        }
    }

    // We cannot use ICellRendererParams directly as the getter needs to be called outside the cell renderer
    export type CellParamValueGetterParams<TRowData = Record<any, any>, TCellValue = any> = {
        value: TCellValue
        valueFormatted: string | null
        rowIndex: number
        node: IRowNode<TRowData>
        api: GridApi<TRowData>
        context: any
    }

    export type CellParamValueGetter<TValue, TRowData = Record<any, any>, TCellValue = any> =
        CellParamValueGetterFn<TValue, TRowData, TCellValue> | TValue

    export type CellParamValueGetterFn<TValue, TRowData = Record<any, any>, TCellValue = any> =
        (args: CellParamValueGetterArgs<TRowData, TCellValue>) => TValue

    export type CellParamValueGetterArgs<TRowData = Record<any, any>, TCellValue = any> = {
        // Populated by getRowData from AgBaseCell
        rowData: TRowData
        params: CellParamValueGetterParams<TRowData, TCellValue>
    }

    export function getCellParamValue<TValue, TRowData = Record<any, any>, TCellValue = any>(
        valueGetter: CellParamValueGetter<TValue, TRowData, TCellValue>,
        args: CellParamValueGetterArgs<TRowData, TCellValue>,
    ): TValue {
        return isFunction(valueGetter)
            ? valueGetter(args)
            : valueGetter
    }

    export type CellRendererEvent<TEventName extends string = string, TData extends Record<string, any> = Record<string, any>,
        TRowData extends Record<string, any> = Record<string, any>,
        TColDef extends Record<string, any> = Record<string, any>> = {
            eventName: TEventName
            data?: TData
            rowData?: TRowData
            colDef?: TColDef
        }

}
