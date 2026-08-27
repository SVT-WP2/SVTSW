import { Component, computed, inject, signal } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import {
    EpicAsic,
    EpicAsicsApiClient,
    EpicChip,
    EpicChipBlock,
    EpicChipBlocksApiClient,
    EpicChipsApiClient,
} from 'epic-ui/api'
import { EpicBreadcrumbs, EpicNotificationService } from 'epic-ui/common/components'
import { EpicChipLocationHistoryDialogService, EpicChipLocationUpdateDialogService } from 'epic-ui/shared/chips'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'
import { catchError, map, takeUntil, throwError } from 'rxjs'


@Component({
    selector: 'epic-chip-details-page',
    templateUrl: 'epic-chip-details-page.component.html',
    standalone: false,
})
export class EpicChipDetailsPageComponent extends BaseComponent {

    readonly chip = signal<EpicChip>(null)
    readonly asic = signal<EpicAsic>(null)
    readonly chipBlocks = signal<EpicChipBlock[]>([])
    readonly chipFetchOneProcessing = signal<ProcessingStore.EventProcessingState>(
        ProcessingStore.getDefaultProcessingState(),
    )

    readonly breadcrumbs = computed<EpicBreadcrumbs.Breadcrumb[]>(() => [
        {
            id: 'list',
            label: 'Chips',
            routerLink: '../../list',
        },
        {
            id: 'details',
            label: this.chip() ? this.chip().serialNumber : this.chipId.toString(),
            active: true,
            disabled: true,
        },
    ])

    // DI
    protected readonly activatedRoute = inject(ActivatedRoute)
    protected readonly epicChipsApiClient = inject(EpicChipsApiClient)
    protected readonly epicAsicsApiClient = inject(EpicAsicsApiClient)
    protected readonly epicChipBlocksApiClient = inject(EpicChipBlocksApiClient)
    protected readonly epicChipLocationHistoryDialogService = inject(EpicChipLocationHistoryDialogService)
    protected readonly epicChipLocationUpdateDialogService = inject(EpicChipLocationUpdateDialogService)
    protected readonly epicNotificationService = inject(EpicNotificationService)

    constructor() {
        super()

        this.initChip()
    }

    get chipId(): number {
        return +this.activatedRoute.snapshot.params['chipId']
    }

    onUpdateLocation(): void {
        this.epicChipLocationUpdateDialogService.openDialog(
            this.chipId,
            {
                onSuccess: (chip) => this.chip.set(chip),
            },
        )
    }

    onOpenLocationHistory(): void {
        void this.epicChipLocationHistoryDialogService.openDialog(this.chipId)
    }

    protected initChip(): void {
        this.chipFetchOneProcessing.set(
            ProcessingStore.eventProcessingStart(this.chipFetchOneProcessing()),
        )

        this.epicChipsApiClient.fetchOne(this.chipId)
            .pipe(
                takeUntil(this.destroyed$),
                catchError((error: Error) => {
                    this.chipFetchOneProcessing.set(
                        ProcessingStore.eventProcessingFinish(this.chipFetchOneProcessing(), error),
                    )
                    return throwError(() => error)
                }),
            )
            .subscribe((chip) => {
                this.chip.set(chip)
                this.chipFetchOneProcessing.set(
                    ProcessingStore.eventProcessingFinish(this.chipFetchOneProcessing()),
                )
                this.initParentAsic()
                this.initChipBlocks()
            })
    }

    protected initParentAsic(): void {
        this.epicAsicsApiClient.fetchAsicsList({ chipId: this.chipId }, { offset: 0, limit: 1 })
            .pipe(
                takeUntil(this.destroyed$),
                map((response) => response.items[0] || null),
                catchError((error: Error) => {
                    this.epicNotificationService.error(
                        error.message,
                        'Unable to Fetch Parent ASIC Info',
                    )
                    return throwError(() => error)
                }),
            )
            .subscribe((asic) => {
                this.asic.set(asic)
            })
    }

    protected initChipBlocks(): void {
        this.epicChipBlocksApiClient.fetchList({ chipId: this.chipId })
            .pipe(
                takeUntil(this.destroyed$),
                map((response) => response.items || []),
                catchError((error: Error) => {
                    this.epicNotificationService.error(
                        error.message,
                        'Unable to Fetch Chip Blocks Info',
                    )
                    return throwError(() => error)
                }),
            )
            .subscribe((chipBlocks) => {
                this.chipBlocks.set(chipBlocks)
            })
    }

}
