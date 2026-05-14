import { Component, computed, inject, input, Signal } from '@angular/core'
import { MatDivider } from '@angular/material/list'
import { MatTooltip } from '@angular/material/tooltip'
import { RouterLink, RouterOutlet } from '@angular/router'
import { Store } from '@ngrx/store'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicSvtTestSetup, EpicSvtTestSetupConfig } from 'epic-ui/api'
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
import { EpicSvtTestSetupConfigCreateDialogService, EpicSvtTestSetupsActions, EpicSvtTestSetupsSelectors } from 'epic-ui/shared/svt-tests'
import { BaseComponent, EpicSearchPipe, ProcessingStore } from 'epic-ui/utils'

import StoreSelectors = EpicSvtTestSetupsSelectors
import StoreActions = EpicSvtTestSetupsActions


@Component({
    selector: 'epic-svt-test-setup-details-page',
    templateUrl: 'epic-svt-test-setup-details-page.component.html',
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
export class EpicSvtTestSetupDetailsPageComponent extends BaseComponent {

    readonly testSetupId = input<string>()

    readonly testSetup: Signal<EpicSvtTestSetup>
    readonly testSetupConfigs: Signal<EpicSvtTestSetupConfig[]>
    readonly dataFetchingProcessing: Signal<ProcessingStore.EventProcessingState>

    readonly navTabs = computed<EpicNavTabs.NavTabInfo[]>(() =>
        this.testSetupConfigs()
            .map((item) => ({
                routerLink: `./config/${item.id}`,
                label: item.name,
                routerLinkActiveOptions: { exact: false },
                additionalData: {
                    isDefault: item.id === this.testSetup()?.defaultConfigId,
                },
            })),
    )

    readonly breadcrumbs = computed<EpicBreadcrumbs.Breadcrumb[]>(() => [
        {
            id: 'list',
            label: 'Test Setups',
            routerLink: '../../list',
        },
        {
            id: 'details',
            label: this.testSetup()?.name ?? 'Details',
            active: true,
            disabled: true,
        },
    ])

    searchTerm: string

    // DI
    protected readonly store = inject(Store)
    protected readonly epicSvtTestSetupConfigCreateDialogService = inject(EpicSvtTestSetupConfigCreateDialogService)

    constructor() {
        super()

        this.dataFetchingProcessing = this.store.selectSignal(StoreSelectors.selectFetchAllProcessing)
        const allTestSetups = this.store.selectSignal(StoreSelectors.selectAllTestSetups)
        const allTestSetupConfigs = this.store.selectSignal(StoreSelectors.selectAllTestSetupConfigs)
        const isAllDataFetched = this.store.selectSignal(StoreSelectors.selectIsAllDataFetched)

        this.testSetupConfigs = computed<EpicSvtTestSetupConfig[]>(() => {
            return allTestSetupConfigs().filter(item => item.setupId === +this.testSetupId())
        })

        this.testSetup = computed<EpicSvtTestSetup>(() => {
            return allTestSetups().find(item => item.id === +this.testSetupId())
        })

        if (!isAllDataFetched()) {
            this.store.dispatch(
                StoreActions.fetchAllRequestAction({}),
            )
        }

    }

    onCreateConfig(): void {
        this.epicSvtTestSetupConfigCreateDialogService.openDialog({ testSetupId: this.testSetup().id })
    }

}
