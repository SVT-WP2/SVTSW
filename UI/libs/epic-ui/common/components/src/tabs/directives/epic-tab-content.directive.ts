import { Directive, TemplateRef } from '@angular/core'


@Directive({
    selector: '[epicTabContent]ng-template',
    standalone: false,
})
export class EpicTabContentDirective {

    constructor(
        readonly templateRef: TemplateRef<any>,
    ) {
    }

}

