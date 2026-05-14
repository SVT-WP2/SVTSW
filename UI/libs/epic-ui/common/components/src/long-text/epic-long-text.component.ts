import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, Input, ViewChild } from '@angular/core'
import { MatTooltipModule } from '@angular/material/tooltip'


@Component({
    selector: 'epic-long-text,[epic-long-text]',
    templateUrl: './epic-long-text.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatTooltipModule,
    ],
})
export class EpicLongTextComponent {

    @ViewChild('contentWrapperRef', { read: ElementRef, static: true }) contentWrapperRef: ElementRef<HTMLElement>

    @Input() tooltip: string
    @Input() isTextTooLong = false

    constructor(protected readonly changeDetectionRef: ChangeDetectorRef) {
    }

    @HostListener('mouseover') onHover(): void {
        this.recalculateIsTextTooLong()
    }

    private recalculateIsTextTooLong(): void {
        const isTextTooLong = this.contentWrapperRef.nativeElement.scrollWidth > this.contentWrapperRef.nativeElement.offsetWidth

        if (isTextTooLong !== this.isTextTooLong) {
            this.isTextTooLong = isTextTooLong
            this.changeDetectionRef.detectChanges()
        }
    }

}
