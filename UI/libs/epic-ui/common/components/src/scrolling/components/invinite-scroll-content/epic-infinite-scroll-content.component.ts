import { NgTemplateOutlet } from '@angular/common'
import { ChangeDetectionStrategy, Component, model, output } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { TranslatePipe } from '@ngx-translate/core'
import { ProcessingStore } from 'epic-ui/utils'

import { EpicButtonModule } from '../../../button'
import { EpicContentErrorMessagePipe, EpicContentErrorModule } from '../../../content-error'
import { EpicIconComponent } from '../../../icon'
import { EpicNoResultModule, EpicNoResult } from '../../../no-result'
import { EpicSkeletonLoader, EpicSkeletonLoaderComponent } from '../../../skeleton-loader'


@Component({
    selector: 'epic-infinite-scroll-content',
    templateUrl: './epic-infinite-scroll-content.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        EpicContentErrorModule,
        MatButton,
        EpicButtonModule,
        TranslatePipe,
        EpicNoResultModule,
        EpicSkeletonLoaderComponent,
        NgTemplateOutlet,
        EpicIconComponent,
        EpicContentErrorMessagePipe,
    ],
})
export class EpicInfiniteScrollContentComponent {

    readonly fetchDataProcessing = model<ProcessingStore.EventProcessingState>(ProcessingStore.getDefaultProcessingState())
    readonly fetchMoreDataProcessing = model<ProcessingStore.EventProcessingState>(ProcessingStore.getDefaultProcessingState())
    readonly noDataFound = model<boolean>(false)
    readonly processRetry = model<boolean>(true)
    readonly skeletonLoaderSize = model<EpicSkeletonLoader.Size>(EpicSkeletonLoader.Size.md)
    readonly noResultSize = model<EpicNoResult.Size>(EpicNoResult.Size.small)

    readonly retry = output<void>()

    onProcessRetry(): void {
        this.retry.emit()
    }

}
