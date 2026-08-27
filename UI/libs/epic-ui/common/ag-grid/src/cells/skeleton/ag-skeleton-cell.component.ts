import { ChangeDetectionStrategy, Component } from '@angular/core'
import { ICellRendererAngularComp } from 'ag-grid-angular'
import { EpicSkeletonLoaderComponent } from 'epic-ui/common/components'


/**
 * Placeholder of a cell whose row has not been loaded yet. It reads nothing from the params — the row has no
 * data at this point, that is the whole reason it is rendered.
 */
@Component({
    selector: 'ag-skeleton-cell',
    template: `
        <div class="epic-ag-cell--vertical-centered">
            <epic-skeleton-loader size="sm"/>
        </div>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        EpicSkeletonLoaderComponent,
    ],
})
export class AgSkeletonCellComponent implements ICellRendererAngularComp {

    agInit(): void {
        // NOTHING TO INIT
    }

    /** Returning false makes the grid drop this placeholder and build the real cell once the row data lands. */
    refresh(): boolean {
        return false
    }

}
