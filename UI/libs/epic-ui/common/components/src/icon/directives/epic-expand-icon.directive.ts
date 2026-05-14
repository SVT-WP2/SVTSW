import { Directive } from '@angular/core'

import { EpicIconComponent } from '../../icon'


@Directive({
    selector: '[epicExpandIcon]epic-icon',
})
export class EpicExpandIconDirective {

    constructor(private readonly epicIconComponent: EpicIconComponent) {
        this.epicIconComponent.name.set('epic-arrow-chevron-down')
    }

}
