import { Component, computed, inject, signal } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { EpicChip, EpicChipBlock, EpicChipBlocksApiClient, EpicChipsApiClient } from 'epic-ui/api'
import { EpicBreadcrumbs, EpicNotificationService } from 'epic-ui/common/components'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'
import { catchError, takeUntil, throwError } from 'rxjs'


@Component({
    selector: 'epic-chip-block-details-page',
    templateUrl: 'epic-chip-block-details-page.component.html',
    standalone: false,
})
export class EpicChipBlockDetailsPageComponent extends BaseComponent {

    readonly chipBlock = signal<EpicChipBlock>(null)
    readonly chip = signal<EpicChip>(null)
    readonly chipBlockFetchOneProcessing = signal<ProcessingStore.EventProcessingState>(
        ProcessingStore.getDefaultProcessingState(),
    )

    readonly breadcrumbs = computed<EpicBreadcrumbs.Breadcrumb[]>(() => [
        {
            id: 'list',
            label: 'Chip Blocks',
            routerLink: '../../list',
        },
        {
            id: 'details',
            label: this.chipBlock() ? this.chipBlock().serialNumber : this.chipBlockId.toString(),
            active: true,
            disabled: true,
        },
    ])

    // DI
    protected readonly activatedRoute = inject(ActivatedRoute)
    protected readonly epicChipBlocksApiClient = inject(EpicChipBlocksApiClient)
    protected readonly epicChipsApiClient = inject(EpicChipsApiClient)
    protected readonly epicNotificationService = inject(EpicNotificationService)

    constructor() {
        super()

        this.initChipBlock()
    }

    get chipBlockId(): number {
        return +this.activatedRoute.snapshot.params['chipBlockId']
    }

    protected initChipBlock(): void {
        this.chipBlockFetchOneProcessing.set(
            ProcessingStore.eventProcessingStart(this.chipBlockFetchOneProcessing()),
        )

        this.epicChipBlocksApiClient.fetchOne(this.chipBlockId)
            .pipe(
                takeUntil(this.destroyed$),
                catchError((error: Error) => {
                    this.chipBlockFetchOneProcessing.set(
                        ProcessingStore.eventProcessingFinish(this.chipBlockFetchOneProcessing(), error),
                    )
                    return throwError(() => error)
                }),
            )
            .subscribe((chipBlock) => {
                this.chipBlock.set(chipBlock)
                this.chipBlockFetchOneProcessing.set(
                    ProcessingStore.eventProcessingFinish(this.chipBlockFetchOneProcessing()),
                )
                this.initParentChip(chipBlock.chipId)
            })
    }

    protected initParentChip(chipId: number): void {
        if (!chipId) {
            return
        }

        this.epicChipsApiClient.fetchOne(chipId)
            .pipe(
                takeUntil(this.destroyed$),
                catchError((error: Error) => {
                    this.epicNotificationService.error(
                        error.message,
                        'Unable to Fetch Parent Chip Info',
                    )
                    return throwError(() => error)
                }),
            )
            .subscribe((chip) => {
                this.chip.set(chip)
            })
    }

}
