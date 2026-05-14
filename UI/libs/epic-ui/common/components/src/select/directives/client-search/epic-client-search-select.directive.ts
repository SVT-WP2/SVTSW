import { Directive, Input, OnInit, Self } from '@angular/core'
import { BaseDirective } from 'epic-ui/utils'
import { get } from 'lodash-es'
import { takeUntil } from 'rxjs/operators'

import { EpicSelectComponent } from '../../components'


@Directive({
    selector: 'epic-select[epicClientSearchSelect]',
    standalone: false,
})
export class EpicClientSearchSelectDirective<T = unknown> extends BaseDirective implements OnInit {

    @Input() searchFn: (entity: T, searchTerm: string) => boolean
    @Input() options: T[]

    constructor(
        @Self() private readonly selectRef: EpicSelectComponent<T>,
    ) {
        super()
    }

    ngOnInit(): void {
        this.selectRef.search$
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe((searchTerm) => {
                this.selectRef.panelScrollTop()
                this.selectRef.options = this.getFilteredOptions(searchTerm)
            })

        this.selectRef.panelClosed$
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe(() => {
                this.selectRef.options = this.options
            })
    }

    protected getFilteredOptions(search: string): T[] {
        if (!search?.length) {
            return [...this.options]
        }

        if (this.searchFn) {
            return this.options.filter(item => this.searchFn(item, search))
        }

        const decoratedSearch = search.trim().toLowerCase()

        return this.options.filter(item => {
            const value = !this.selectRef.bindLabel ? item : get(item, this.selectRef.bindLabel)

            return (value as string).trim().toLowerCase().includes(decoratedSearch)
        })
    }

}
