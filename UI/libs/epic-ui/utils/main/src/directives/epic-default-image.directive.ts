import { Directive, ElementRef, HostListener, Input, Renderer2 } from '@angular/core'


@Directive({
    selector: '[epicDefaultImage]img',
    standalone: true,
})
export class EpicDefaultImageDirective {

    @Input({ required: true }) epicDefaultImage: string | undefined // image url

    constructor(
        private readonly renderer: Renderer2,
        private readonly elementRef: ElementRef<HTMLImageElement>,
    ) {
    }

    @HostListener('error') onImageLoadError(): void {
        const imageElm = this.elementRef.nativeElement
        // display default image on load error
        if (this.epicDefaultImage && imageElm.src !== this.epicDefaultImage) {
            this.renderer.setAttribute(
                this.elementRef.nativeElement, 'src', this.epicDefaultImage,
            )
        }
    }

}
