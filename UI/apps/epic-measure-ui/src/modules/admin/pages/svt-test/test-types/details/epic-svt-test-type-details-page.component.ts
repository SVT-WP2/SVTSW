import { Component, computed, inject, input, OnDestroy, OnInit, Signal } from '@angular/core'
import { MatDivider } from '@angular/material/list'
import { MatTooltip } from '@angular/material/tooltip'
import { RouterLink, RouterOutlet } from '@angular/router'
import { Store } from '@ngrx/store'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicSvtTestType, EpicSvtTestTypeConfig } from 'epic-ui/api'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicIconMatOutlinedPipe,
    EpicLoaderComponent,
    EpicNoResultModule, EpicBreadcrumbs, EpicBreadcrumbsModule,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
    EpicLabelModule,
    EpicNavTabs,
    EpicSearchBoxComponent,
    EpicTabsModule,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicSvtTestTypeConfigCreateDialogService,
    EpicSvtTestTypesActions,
    EpicSvtTestTypesSelectors,
} from 'epic-ui/shared/svt-test/test-types'
import { BaseComponent, EpicSearchPipe, ProcessingStore } from 'epic-ui/utils'

import StoreSelectors = EpicSvtTestTypesSelectors
import StoreActions = EpicSvtTestTypesActions


@Component({
    selector: 'epic-svt-test-type-details-page',
    templateUrl: 'epic-svt-test-type-details-page.component.html',
    imports: [
        EpicLayoutLightModule,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicIconComponent,
        MatDivider,
        RouterLink,
        MatTooltip,
        TranslatePipe,
        EpicLabelModule,
        EpicIconMatOutlinedPipe,
        EpicTabsModule,
        RouterOutlet,
        EpicSearchBoxComponent,
        EpicSearchPipe,
        EpicNoResultModule,
        EpicLoaderComponent,
        EpicContentErrorMessagePipe,
        EpicBreadcrumbsModule,
    ],
})
export class EpicSvtTestTypeDetailsPageComponent extends BaseComponent implements OnInit, OnDestroy {

    readonly testTypeId = input<string>()

    readonly testType: Signal<EpicSvtTestType>
    readonly testTypeConfigs: Signal<EpicSvtTestTypeConfig[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    readonly navTabs = computed<EpicNavTabs.NavTabInfo[]>(() =>
        this.testTypeConfigs()
            .map((item) => ({
                routerLink: `./config/${item.id}`,
                label: item.name,
                routerLinkActiveOptions: { exact: false },
            })),
    )

    readonly breadcrumbs = computed<EpicBreadcrumbs.Breadcrumb[]>(() => [
        {
            id: 'list',
            label: 'Test Types',
            routerLink: '../../list',
        },
        {
            id: 'details',
            label: this.testType()?.name ?? 'Details',
            active: true,
            disabled: true,
        },
    ])

    searchTerm: string

    // DI
    protected readonly store = inject(Store)
    protected readonly epicSvtTestTypeConfigCreateDialogService = inject(EpicSvtTestTypeConfigCreateDialogService)

    constructor() {
        super()

        this.dataFetchingProcessing = this.store.selectSignal(StoreSelectors.selectFetchAllProcessing)
        const isAllDataFetched = this.store.selectSignal(StoreSelectors.selectIsAllDataFetched)
        this.testTypeConfigs = this.store.selectSignal(StoreSelectors.selectActiveTestTypeConfigs)
        this.testType = this.store.selectSignal(StoreSelectors.selectActiveTestType)

        if (!isAllDataFetched()) {
            this.store.dispatch(
                StoreActions.fetchAllRequestAction({}),
            )
        }
    }

    ngOnInit(): void {
        this.store.dispatch(
            StoreActions.setActiveTestTypeAction({ testTypeId: +this.testTypeId() }),
        )
    }

    onCreateConfig(): void {
        this.epicSvtTestTypeConfigCreateDialogService.openDialog({ testTypeId: this.testType().id })
    }

    ngOnDestroy(): void {
        super.ngOnDestroy()
        this.store.dispatch(
            StoreActions.setActiveTestTypeAction({ testTypeId: null }),
        )
    }

}
