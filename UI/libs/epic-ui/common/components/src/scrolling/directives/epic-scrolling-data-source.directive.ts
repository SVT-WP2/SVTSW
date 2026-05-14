import { Directive, ElementRef, inject, OnInit, Renderer2, OnDestroy } from '@angular/core'

import { EpicBaseScrollingDataSourceDirective } from './epic-base-scrolling-data-source.directive'


@Directive({
    selector: '[epicInfiniteScrolling]div',
})
export class EpicScrollingDataSourceDirective extends EpicBaseScrollingDataSourceDirective implements OnInit, OnDestroy {

    protected readonly elementRef = inject(ElementRef<HTMLElement>)
    protected readonly renderer = inject(Renderer2)

    protected scrollListener: () => void
    protected theFirstScrollTriggered = false

    override ngOnInit(): void {
        super.ngOnInit()

        this.scrollListener = this.renderer.listen(
            this.elementRef.nativeElement,
            'scroll',
            () => {
                if (this.theFirstScrollTriggered) {
                    this.processLoadMore()
                }
                else {
                    this.theFirstScrollTriggered = true
                }
            },
        )
    }

    override ngOnDestroy(): void {
        this.scrollListener()
    }

    protected getHostNativeElement(): HTMLElement {
        return this.elementRef.nativeElement
    }

}
