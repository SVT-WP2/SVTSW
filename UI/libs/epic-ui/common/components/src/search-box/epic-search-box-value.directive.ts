import { Directive, effect, inject, model, OnInit } from '@angular/core'
import { BaseDirective } from 'epic-ui/utils'

import { EpicSearchBoxComponent } from './epic-search-box.component'


@Directive({
    selector: '[epicSearchBoxValue]epic-search-box',
})
export class EpicSearchBoxValueDirective extends BaseDirective implements OnInit {

    readonly epicSearchBoxComponent = inject(EpicSearchBoxComponent)

    readonly epicSearchBoxValue = model.required<string>()

    constructor() {
        super()
        effect(() => {
            this.epicSearchBoxComponent.searchTerm = this.epicSearchBoxValue()
        })
    }

    ngOnInit(): void {
        this.epicSearchBoxComponent.search$
            .subscribe(value => {
                this.epicSearchBoxValue.set(value)
            })
    }

}
