import { Component, inject, Signal, viewChild } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { ActivatedRoute } from '@angular/router'
import { EpicSvtDutEntityName } from 'epic-ui/api'
import { EpicSvtDutTestsContainerComponent } from 'epic-ui/shared/svt-test/tests'
import { BaseComponent } from 'epic-ui/utils'
import { map } from 'rxjs'


@Component({
    selector: 'epic-asic-svt-tests-page',
    templateUrl: 'epic-asic-svt-tests-page.component.html',
    standalone: false,
})
export class EpicAsicSvtTestsPageComponent extends BaseComponent {

    /** Whatever this page shows is about the ASIC of the details page it lives in. */
    readonly dutEntityName = EpicSvtDutEntityName.Asic
    readonly asicId: Signal<number | undefined>

    readonly epicSvtDutTestsContainerComponent = viewChild(EpicSvtDutTestsContainerComponent)

    // DI
    protected readonly activatedRoute = inject(ActivatedRoute)

    constructor() {
        super()

        this.asicId = toSignal(
            this.activatedRoute.parent.params
                .pipe(
                    map(params => +params['asicId']),
                ),
        )
    }

    protected onReload(): void {
        this.epicSvtDutTestsContainerComponent().reload()
    }

}
