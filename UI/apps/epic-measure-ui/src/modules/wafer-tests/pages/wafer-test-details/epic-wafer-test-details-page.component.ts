import { Component, computed, inject, Signal, signal } from '@angular/core'
import { MatDivider } from '@angular/material/divider'
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu'
import { ActivatedRoute, Router } from '@angular/router'
import { Store } from '@ngrx/store'
import { EpicAsicTest, EpicWaferTestStatus } from 'epic-ui/api'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicIconMatOutlinedPipe,
    EpicBreadcrumbs,
    EpicBreadcrumbsModule,
    EpicContentErrorModule,
    EpicLabelModule,
    EpicLoaderComponent, EpicContentErrorMessagePipe,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import {
    EpicAsicTestExtended,
    EpicWaferAsicTestsListComponent,
    EpicWaferTestExtended,
    EpicWaferTestExtendedInfoComponent,
    EpicWaferTestProgressWidgetComponent,
    EpicWaferTestsActions,
    EpicWaferTestsSelectors,
} from 'epic-ui/shared/wafer-tests'
import { getMockEpicAsicTestsList } from 'epic-ui/shared/wafer-tests/__mock__'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'

import StoreSelectors = EpicWaferTestsSelectors
import StoreActions = EpicWaferTestsActions


@Component({
    selector: 'epic-wafer-test-details-page',
    templateUrl: 'epic-wafer-test-details-page.component.html',
    imports: [
        EpicLayoutLightModule,
        EpicButtonModule,
        EpicLoaderComponent,
        EpicContentErrorModule,
        EpicBreadcrumbsModule,
        EpicWaferTestExtendedInfoComponent,
        EpicIconComponent,
        MatMenu,
        MatMenuItem,
        MatMenuTrigger,
        EpicLabelModule,
        MatDivider,
        EpicIconMatOutlinedPipe,
        EpicWaferAsicTestsListComponent,
        EpicWaferTestProgressWidgetComponent,
        EpicContentErrorMessagePipe,
    ],
})
export class EpicWaferTestDetailsPageComponent extends BaseComponent {

    readonly EpicWaferTestStatus = EpicWaferTestStatus

    readonly waferTest: Signal<EpicWaferTestExtended>
    // readonly asicTestsList: Signal<EpicAsicTest[]>
    readonly asicTestsList = signal<EpicAsicTest[]>([])
    readonly asicTestsFetchProcessing = signal<ProcessingStore.EventProcessingState>(ProcessingStore.getDefaultProcessingState())
    readonly waferTestFetchProcessing: Signal<ProcessingStore.EventProcessingState>
    readonly breadcrumbs = computed<EpicBreadcrumbs.Breadcrumb[]>(() => [
        {
            id: 'list',
            label: 'Wafer Tests',
            routerLink: '../../list',
        },
        {
            id: 'details',
            label: this.waferTest() ? this.waferTest().name : `#${this.waferTestId}`,
            active: true,
            disabled: true,
        },
    ])

    readonly waferAsicTests = signal<EpicAsicTestExtended[]>(
        getMockEpicAsicTestsList()
            .map(item => ({
                ...item,
                asic: {
                    serialNumber: `1_${item.id}`,
                } as any,
            })),
    )

    // DI
    protected readonly store = inject(Store)
    protected readonly activatedRoute = inject(ActivatedRoute)
    protected readonly router = inject(Router)

    constructor() {
        super()

        this.store.dispatch(StoreActions.fetchOneRequestAction({ entityId: this.waferTestId }))

        this.waferTest = this.store.selectSignal(StoreSelectors.selectOneWaferTest(this.waferTestId))
        this.waferTestFetchProcessing = this.store.selectSignal(StoreSelectors.selectFetchOneProcessing)
    }

    get waferTestId(): number {
        return +this.activatedRoute?.snapshot?.params?.['waferTestId']
    }

    onEdit(): void {

    }

}
