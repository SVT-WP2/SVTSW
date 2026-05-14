import { Directive, Input, OnInit } from '@angular/core'
import { BaseDirective } from 'epic-ui/utils'

import { IEpicScrollingDataSource } from '../services'


@Directive({
    selector: '[epicBaseScrollingDataSource]',
})
export abstract class EpicBaseScrollingDataSourceDirective extends BaseDirective implements OnInit {

    @Input({ required: true }) dataSource: IEpicScrollingDataSource<any, any>
    @Input() initAutoFetchData = true
    @Input() scrollSpaceMargin = 500

    ngOnInit(): void {
        if (this.initAutoFetchData) {
            this.dataSource.actionFetchData()
        }
    }

    protected canFetchMore(): boolean {
        return this.dataSource.data()!.hasMoreItems
    }

    protected processLoadMore(): void {
        if (!this.canFetchMore()) {
            return
        }
        const containerElm = this.getHostNativeElement()
        const isScrollBottom = containerElm.scrollTop + this.scrollSpaceMargin
            > (containerElm.scrollHeight - containerElm.clientHeight)

        const anyDataFetchingProcessing = this.dataSource.fetchDataProcessing()!.processing
            || this.dataSource.fetchMoreDataProcessing()!.processing
        const anyDataFetchingProcessingError = !!this.dataSource.fetchDataProcessing()!.processingError
            || !!this.dataSource.fetchMoreDataProcessing()!.processingError


        const isFetchMoreRequired = isScrollBottom && this.canFetchMore() && !anyDataFetchingProcessing && !anyDataFetchingProcessingError
        if (isFetchMoreRequired) {
            this.dataSource.actionFetchMoreData()
        }
    }

    protected abstract getHostNativeElement(): HTMLElement

}
