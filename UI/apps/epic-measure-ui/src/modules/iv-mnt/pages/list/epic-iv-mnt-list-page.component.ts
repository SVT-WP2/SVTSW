import { Component, inject, OnDestroy, OnInit } from '@angular/core'
import { EpicIvMnt } from 'epic-ui/api'
import { EpicBreadcrumbs } from 'epic-ui/common/components'
import { IvMntDataSource } from 'epic-ui/shared/iv-mnt'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'
import { Observable } from 'rxjs'


@Component({
    selector: 'epic-wafers-list-page',
    templateUrl: 'epic-iv-mnt-list-page.component.html',
    standalone: false,
    providers: [
        IvMntDataSource,
    ],
})
export class EpicIvMntListPageComponent extends BaseComponent implements OnInit, OnDestroy {

    readonly breadcrumbs: EpicBreadcrumbs.Breadcrumb[] = [
        {
            id: 'list',
            label: 'Measurements',
            routerLink: '../',
        },
        {
            id: 'detail',
            routerLink: '../',
            label: 'IV',
            active: true,
            disabled: true,
        },
    ]

    readonly entitiesList$: Observable<EpicIvMnt[]>
    readonly loadingProcessing$: Observable<ProcessingStore.EventProcessingState>

    // DI
    protected readonly ivMntDataSource = inject(IvMntDataSource)


    constructor() {
        super()

        this.entitiesList$ = this.ivMntDataSource.data$
        this.loadingProcessing$ = this.ivMntDataSource.loadingProcessing$
    }

    ngOnInit(): void {
        this.ivMntDataSource.load()
    }

    ngOnDestroy(): void {
        super.ngOnDestroy()
        this.ivMntDataSource.disconnect()
    }

}
