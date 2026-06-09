import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core'

import { EpicButton } from '../models'


@Directive({
    selector: 'button[epicButtonSize], button[epicButtonStyle], ' +
        'button[mat-icon-button][epicButtonStyle], button[mat-icon-button][epicButtonSize]',
    standalone: false,
})
export class EpicButtonDirective implements OnChanges {

    @Input() epicButtonSize: EpicButton.ButtonSize
    @Input() epicButtonStyle: EpicButton.ButtonStyle

    constructor(private readonly elementRef: ElementRef<HTMLElement>) {
        this.processButtonAttributes()
    }

    ngOnChanges(changes: SimpleChanges): void {
        const { epicButtonSize } = changes

        if (epicButtonSize) {
            this.processButtonAttributes()
        }
    }

    private processButtonAttributes(): void {
        this.elementRef.nativeElement.classList.add(EpicButton.BASE_CLASS_NAME)

        if (this.epicButtonSize) {
            for (const buttonSize of Object.values(EpicButton.ButtonSize)) {
                const cssClassName = EpicButton.getSizeCssClassName(buttonSize)
                if (this.epicButtonSize !== buttonSize) {
                    this.elementRef.nativeElement.classList.remove(cssClassName)
                }
                else {
                    this.elementRef.nativeElement.classList.add(cssClassName)
                }
            }
        }

        if (this.epicButtonStyle) {
            for (const buttonStyle of Object.values(EpicButton.ButtonStyle)) {
                const cssClassName = EpicButton.getStyleCssClassName(buttonStyle)
                if (this.epicButtonStyle !== buttonStyle) {
                    this.elementRef.nativeElement.classList.remove(cssClassName)
                }
                else {
                    this.elementRef.nativeElement.classList.add(cssClassName)
                }
            }
        }
    }

}
