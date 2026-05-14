import { Component, OnDestroy } from '@angular/core'
import { Subject } from 'rxjs'


export interface IBaseComponent extends OnDestroy {
    destroyed$: Subject<void>
}

@Component({
    selector: 'epic-base',
    template: '',
})
export abstract class BaseComponent implements IBaseComponent, OnDestroy {

    readonly destroyed$ = new Subject<void>()

    ngOnDestroy(): void {
        this.destroyed$.next()
        this.destroyed$.complete()
    }

}
