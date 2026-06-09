import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { Directive, inject, OnInit } from '@angular/core'
import { takeUntil } from 'rxjs'
import { skip } from 'rxjs/operators'

import { EpicBaseScrollingDataSourceDirective } from './epic-base-scrolling-data-source.directive'


@Directive({
    selector: '[epicInfiniteScrolling]cdk-virtual-scroll-viewport',
})
export class EpicScrollingDataSourceVirtualScrollViewportDirective extends EpicBaseScrollingDataSourceDirective implements OnInit {

    protected readonly cdkVirtualScrollViewport = inject(CdkVirtualScrollViewport)

    override ngOnInit(): void {
        super.ngOnInit()
        this.cdkVirtualScrollViewport.scrolledIndexChange
            .pipe(
                takeUntil(this.destroyed$),
                skip(1),
            )
            .subscribe(() => {
                this.processLoadMore()
            })
    }

    protected getHostNativeElement(): HTMLElement {
        return this.cdkVirtualScrollViewport.elementRef.nativeElement
    }


}
