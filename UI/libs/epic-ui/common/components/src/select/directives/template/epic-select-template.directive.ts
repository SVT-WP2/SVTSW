import { Directive, Input, TemplateRef } from '@angular/core'

import { EpicSelect } from '../../models'


@Directive({
    selector: '[epicSelectTemplate]',
    standalone: false,
})
export class EpicSelectTemplateDirective {

    @Input('epicSelectTemplate') templateName: EpicSelect.TemplateName

    constructor(public template: TemplateRef<any>) {
    }

}
