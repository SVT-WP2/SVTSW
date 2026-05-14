import { Directive, OnDestroy } from '@angular/core'
import { Subject } from 'rxjs'


@Directive()
export abstract class BaseDirective implements OnDestroy {

    readonly destroyed$ = new Subject<void>()

    ngOnDestroy(): void {
        this.destroyed$.next()
        this.destroyed$.complete()
    }

}
