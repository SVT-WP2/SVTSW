import { Component, inject, OnDestroy } from '@angular/core'
import {
    EpicInstConnectionType,
    EpicIvMntApiClient,
    EpicIvMntCreateRequestPayload,
    EpicIvMntWsFacade,
    EpicSourceMeterType,
} from 'epic-ui/api'
import { EpicBreadcrumbs } from 'epic-ui/common/components'
import { BaseComponent } from 'epic-ui/utils'
import { take, takeUntil } from 'rxjs'


@Component({
    selector: 'epic-iv-mnt-new-page',
    templateUrl: 'epic-iv-mnt-new-page.component.html',
    standalone: false,
})
export class EpicIvMntNewPageComponent extends BaseComponent implements OnDestroy {

    readonly breadcrumbs: EpicBreadcrumbs.Breadcrumb[] = [
        {
            id: 'list',
            label: 'Measurements',
            routerLink: '../',
        },
        {
            id: 'iv',
            routerLink: '../',
            label: 'IV',
        },
        {
            id: 'new',
            routerLink: '',
            label: 'New',
            active: true,
            disabled: true,
        },
    ]

    // DI
    protected readonly epicIvMntApiClient = inject(EpicIvMntApiClient)
    protected readonly epicIvMntWsFacade = inject(EpicIvMntWsFacade)

    onCreateBtnClicked(): void {

        const payload: EpicIvMntCreateRequestPayload = {
            name: 'Iv Mnt :: Client Side #1',
            settings: {
                voltageStart: 0,
                voltageStop: 50,
                voltageStep: 10,
                initDelayInMs: 500,
                sweepDelayInMs: 500,
            },
            sourceMeterConfig: {
                instrumentType: EpicSourceMeterType.FakeSource,
                connectionType: EpicInstConnectionType.None,
            },
        }
        this.startWatchingEvents()
        this.epicIvMntApiClient.createAndStart(payload)
            .pipe(
                take(1),
                takeUntil(this.destroyed$),
            )
            .subscribe(ivMnt => {
                console.log('IV Mnt :: Created', ivMnt)
            })
    }

    private startWatchingEvents(): void {
        this.epicIvMntWsFacade.createConnection()
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe((message) => {
                console.log('WS Message', message)
            })
    }

}
