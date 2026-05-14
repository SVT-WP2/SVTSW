import { computed, Directive, effect, inject, input } from '@angular/core'
import { BaseDirective } from 'epic-ui/utils'

import { EpicInfiniteScrollContentComponent } from '../components'
import { IEpicScrollingDataSource } from '../services'


@Directive({
    selector: '[epicScrollingDataSource]epic-infinite-scroll-content',
    host: {
        '(retry)': 'onRetry()',
    },
})
export class EpicScrollingDataSourceInfiniteScrollContentDirective extends BaseDirective {

    readonly epicScrollingDataSource = input.required<IEpicScrollingDataSource>()

    readonly fetchDataProcessing = computed(() => {
        return this.epicScrollingDataSource()?.fetchDataProcessing()
    })

    readonly fetchMoreDataProcessing = computed(() => {
        return this.epicScrollingDataSource()?.fetchMoreDataProcessing()
    })

    readonly noDataFound = computed(() => {
        return !this.epicScrollingDataSource()?.dataRecords()?.length
            && !this.fetchDataProcessing()?.processing
            && !this.fetchDataProcessing()?.processingError
            && !this.fetchMoreDataProcessing()?.processing
            && !this.fetchMoreDataProcessing()?.processingError
    })

    protected readonly epicInfiniteScrollContentComponent = inject(EpicInfiniteScrollContentComponent)

    constructor() {
        super()

        effect(() => {
            this.epicInfiniteScrollContentComponent.noDataFound.set(this.noDataFound())
        })

        effect(() => {
            this.epicInfiniteScrollContentComponent.fetchDataProcessing.set(this.fetchDataProcessing()!)
        })

        effect(() => {
            this.epicInfiniteScrollContentComponent.fetchMoreDataProcessing.set(this.fetchMoreDataProcessing()!)
        })
    }

    onRetry(): void {
        this.epicScrollingDataSource().actionFetchMoreData()
    }

}
