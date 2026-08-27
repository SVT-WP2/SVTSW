import { ColDef } from 'ag-grid-community'

import { AgSkeletonCellComponent } from './ag-skeleton-cell.component'


export namespace AgSkeletonCell {

    /**
     * Put on `defaultColDef.cellRendererSelector` of a grid running the infinite row model to fill the rows
     * that are still loading with skeleton bars.
     *
     * It has to go through the selector rather than through `loadingCellRenderer`: the grid only reaches for
     * that one on rows flagged as `stub`, which is done by the enterprise server side row model alone. Rows of
     * the community infinite row model are plain nodes without data, so an empty `data` is the only signal
     * that a row has not arrived yet.
     *
     * Returning `undefined` for a loaded row leaves the column's own `cellRenderer` (or the plain value) alone.
     */
    export function getLoadingCellRendererSelector<TRowData = any>(): ColDef<TRowData>['cellRendererSelector'] {
        return (params) => params.data
            ? undefined
            : { component: AgSkeletonCellComponent }
    }

}
