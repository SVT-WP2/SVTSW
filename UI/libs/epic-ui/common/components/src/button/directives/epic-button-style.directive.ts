import { Directive, ElementRef } from '@angular/core'

import { EpicButton } from '../models'


@Directive({
    selector: 'button[epicStrokedButton], button[epicFlatButton], button[epicSmallButton]',
    standalone: false,
})
export class EpicButtonStyleDirective {

    constructor(private readonly elementRef: ElementRef<HTMLElement>) {
        this.processButtonAttributes()
    }

    private hasHostAttributes(...attributes: string[]): boolean {
        return attributes.some(attribute => this.elementRef.nativeElement.hasAttribute(attribute))
    }

    private processButtonAttributes(): void {
        for (const pair of EpicButton.HOST_SELECTOR_TO_EPIC_BUTTON_CLASS_MAP) {
            if (this.hasHostAttributes(pair.selector)) {
                pair.cssClasses.forEach((className: string) => {
                    this.elementRef.nativeElement.classList.add(className)
                })
            }
        }
    }

}
