import { Directive, inject } from '@angular/core'
import { MatListOption } from '@angular/material/list'


@Directive({
    selector: '[epicMatListOption]mat-list-option',
})
export class EpicMatListOptionDirective {

    readonly matListOption = inject(MatListOption)

    constructor() {
        this.matListOption.togglePosition = 'before'
    }
    
}
