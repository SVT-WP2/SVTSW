import { Component, inject, OnDestroy, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { MatTooltip } from '@angular/material/tooltip'
import { ActivatedRoute } from '@angular/router'
import { EpicEnumName } from 'epic-ui/api'
import {
    EpicIconComponent,
    EpicButtonModule,
    EpicContentErrorModule,
    EpicLoaderComponent,
    EpicContentErrorMessagePipe,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { EpicEnumValuesDataSource } from 'epic-ui/shared'
import { EpicWaferEnumsGrid, EpicWaferEnumsListComponent } from 'epic-ui/shared/wafers'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'
import { filter, map, takeUntil } from 'rxjs'


@Component({
    selector: 'epic-admin-enum-values-page',
    templateUrl: 'epic-admin-enum-values-page.component.html',
    imports: [
        EpicLayoutLightModule,
        MatTooltip,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicWaferEnumsListComponent,
        EpicContentErrorMessagePipe,
    ],
    providers: [
        EpicEnumValuesDataSource,
    ],
})
export class EpicAdminEnumValuesPageComponent extends BaseComponent implements OnDestroy {

    readonly entitiesList: Signal<EpicWaferEnumsGrid.RowEntity[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    // DI
    protected readonly dataSource = inject(EpicEnumValuesDataSource)
    protected readonly activatedRoute = inject(ActivatedRoute)

    constructor() {
        super()

        this.entitiesList = toSignal(
            this.dataSource.data$
                .pipe(
                    map(data => (data || []).map(item => ({ name: item }))),
                ),
        )
        this.dataFetchingProcessing = toSignal(this.dataSource.loadingProcessing$)

        this.activatedRoute.params
            .pipe(
                filter(({ enumName }) => !!enumName),
                takeUntil(this.destroyed$),
            )
            .subscribe(({ enumName }) => {
                this.dataSource.setFilter({ enumName: this.enumName })
            })
    }

    get enumName(): EpicEnumName {
        return this.activatedRoute.snapshot.params.enumName as EpicEnumName
    }

    onReload(): void {
        this.dataSource.load(true)
    }

    ngOnDestroy(): void {
        super.ngOnDestroy()
        this.dataSource.disconnect()
    }

}
