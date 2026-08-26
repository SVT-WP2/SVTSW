import { Component, computed, effect, inject, signal, Signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { EpicAsic, EpicChip, EpicChipsApiClient, EpicIvMnt, EpicWafer } from 'epic-ui/api'
import { EpicBreadcrumbs, EpicNavTabs, EpicNotificationService, toEpicMatOutlinedIcon } from 'epic-ui/common/components'
import {
    EpicAsicCreateDialogService,
    EpicAsicDeleteDialogService,
    EpicAsicIvMntDialogService,
    EpicAsicsStoreFacade,
} from 'epic-ui/shared/asics'
import { EpicChipCreateDialogService } from 'epic-ui/shared/chips'
import { EpicWaferRef, EpicWafersStoreFacade } from 'epic-ui/shared/wafers'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'
import { catchError, filter, first, switchMap, takeUntil, tap, throwError } from 'rxjs'


@Component({
    selector: 'epic-asic-details-page',
    templateUrl: 'epic-asic-details-page.component.html',
    standalone: false,
})
export class EpicAsicDetailsPageComponent extends BaseComponent {

    readonly wafer = signal<EpicWafer>(null)
    readonly asic: Signal<EpicAsic>
    readonly chip = signal<EpicChip>(null)
    readonly waferFetchOneProcessing: Signal<ProcessingStore.EventProcessingState>
    readonly asicFetchOneProcessing: Signal<ProcessingStore.EventProcessingState>

    readonly breadcrumbs = computed<EpicBreadcrumbs.Breadcrumb[]>(() => [
        {
            id: 'list',
            label: 'Asics',
            routerLink: '../../list',
        },
        {
            id: 'details',
            label: this.asic() ? this.asic().serialNumber : this.asicId.toString(),
            active: true,
            disabled: true,
        },
    ])

    navTabs: EpicNavTabs.NavTabInfo[] = [
        {
            label: 'Overview',
            routerLink: './overview',
            routerLinkActiveOptions: { exact: false },
            icon: 'epic-eye-open',
        },
        {
            label: 'Voltage Scan',
            routerLink: './voltage-scan',
            routerLinkActiveOptions: { exact: false },
            icon: 'epic-line-chart',
        },
        {
            label: 'Threshold Scan',
            routerLink: './threshold-scan',
            routerLinkActiveOptions: { exact: false },
            icon: toEpicMatOutlinedIcon('data_thresholding'),
        },
        {
            label: 'Noise Test',
            routerLink: './noise-test',
            routerLinkActiveOptions: { exact: false },
            icon: 'graphic_eq',
        },
        {
            label: 'Registers Scan',
            routerLink: './register-scan',
            routerLinkActiveOptions: { exact: false },
            icon: 'scatter_plot',
        },
    ]

    // DI
    protected readonly activatedRoute = inject(ActivatedRoute)
    protected readonly epicAsicDeleteDialogService = inject(EpicAsicDeleteDialogService)
    protected readonly epicAsicCreateDialogService = inject(EpicAsicCreateDialogService)
    protected readonly epicChipsApiClient = inject(EpicChipsApiClient)
    protected readonly asicsStore = inject(EpicAsicsStoreFacade)
    protected readonly wafersStore = inject(EpicWafersStoreFacade)
    protected readonly epicAsicIvMntDialogService = inject(EpicAsicIvMntDialogService)
    protected readonly router = inject(Router)
    protected readonly epicNotificationService = inject(EpicNotificationService)
    protected readonly epicChipCreateDialogService = inject(EpicChipCreateDialogService)

    constructor() {
        super()

        this.asic = toSignal(this.asicsStore.selectOneAsicStream(this.asicId))
        this.waferFetchOneProcessing = toSignal(this.wafersStore.fetchOneProcessing$)
        this.asicFetchOneProcessing = toSignal(this.asicsStore.fetchOneProcessing$)

        this.asicsStore.fetchOneProcessing$
            .pipe(
                takeUntil(this.destroyed$),
                switchMap(() => this.asicsStore.selectOneAsicStream(this.asicId)),
                filter(asic => !!asic),
                first(),
                tap((asic) => this.wafersStore.actionFetchOne(asic.waferId)),
                switchMap((asic) => this.wafersStore.selectOneWaferStream(asic.waferId)),
                filter(wafer => !!wafer),
            )
            .subscribe((wafer: EpicWafer) => {
                this.wafer.set(wafer)
            })

        this.asicsStore.deleteProcessingEvents.success$
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe(() => {
                void this.router.navigate(['/asics/list'])
            })

        this.asicsStore.actionFetchOne({ asicId: this.asicId })

        effect(() => {
            if (this.asic()?.chipId) {
                this.initChip(this.asic().chipId)
            }
        })
    }


    get asicId(): number {
        return +this.activatedRoute.snapshot.params['asicId']
    }

    onAsicDelete(): void {
        this.epicAsicDeleteDialogService.openDialog(this.asicId)
    }

    onAsicEdit(): void {
        this.epicAsicCreateDialogService.openDialog({ asic: this.asic() })
    }

    openDialog(): void {
        this.epicAsicIvMntDialogService.openDialog()
    }

    onRowDetails(rowData: EpicIvMnt) {
        this.epicAsicIvMntDialogService.openDialog({ asicIvMnt: rowData })
    }

    onRowClicked(rowData: EpicIvMnt) {
        this.epicAsicIvMntDialogService.openDialog({ asicIvMnt: rowData })
    }

    onRowRepeat($event: EpicIvMnt) {
        throw new Error('Method not implemented.')
    }

    onCreateChip(): void {
        void this.epicChipCreateDialogService.openDialog({
            asicId: this.asic().id,
            onSuccess: (chip) => {
                this.initChip(chip.id)
                this.asicsStore.actionFetchOne({ asicId: this.asicId, force: true })
            },
        })
    }

    protected getWafersList(): EpicWaferRef[] {
        return this.wafersStore.selectAll()
    }

    protected initChip(chipId: number): void {
        this.epicChipsApiClient.fetchOne(chipId)
            .pipe(
                takeUntil(this.destroyed$),
                catchError((error: Error) => {
                    this.epicNotificationService.error(
                        error.message,
                        'Unable to Fetch Chip Info',
                    )
                    return throwError(() => error)
                }),
            )
            .subscribe((chip) => {
                this.chip.set(chip)
            })
    }

}
