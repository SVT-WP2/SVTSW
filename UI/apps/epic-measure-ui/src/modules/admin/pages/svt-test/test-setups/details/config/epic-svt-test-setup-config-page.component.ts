import { Clipboard } from '@angular/cdk/clipboard'
import { DOCUMENT } from '@angular/common'
import { ChangeDetectionStrategy, Component, computed, inject, input, ResourceRef, Signal } from '@angular/core'
import { rxResource } from '@angular/core/rxjs-interop'
import { MatCardModule } from '@angular/material/card'
import { ActivatedRoute, Router } from '@angular/router'
import { Actions, ofType } from '@ngrx/effects'
import { Store } from '@ngrx/store'
import { EpicSvtTestSetup, EpicSvtTestSetupConfig, EpicSvtTestSetupConfigBody } from 'epic-ui/api'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicLoaderComponent,
    EpicAlertModule,
    EpicContentErrorMessagePipe,
    EpicContentErrorModule,
    EpicLabelModule,
    EpicTabsModule,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { EpicSvtTestSetupConfigBodyDataFacade, EpicSvtTestSetupsActions, EpicSvtTestSetupsSelectors } from 'epic-ui/shared/svt-tests'
import { BaseComponent, FileHelpers } from 'epic-ui/utils'
import { AceModule } from 'ngx-ace-wrapper'
import { takeUntil } from 'rxjs'

import 'brace/mode/hjson'
import StoreSelectors = EpicSvtTestSetupsSelectors
import StoreActions = EpicSvtTestSetupsActions


@Component({
    selector: 'epic-svt-test-setup-config-page',
    templateUrl: 'epic-svt-test-setup-config-page.component.html',
    imports: [
        EpicLayoutLightModule,
        EpicButtonModule,
        EpicContentErrorModule,
        EpicLabelModule,
        EpicTabsModule,
        MatCardModule,
        AceModule,
        EpicIconComponent,
        EpicAlertModule,
        EpicContentErrorMessagePipe,
        EpicLoaderComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpicSvtTestSetupConfigPageComponent extends BaseComponent {

    readonly testSetupConfigId = input<string>()
    readonly testSetupConfig: Signal<EpicSvtTestSetupConfig>
    readonly testSetupConfigBodyResource: ResourceRef<EpicSvtTestSetupConfigBody>
    readonly testSetupConfigBody: Signal<Record<any, any>>
    readonly isDefault: Signal<boolean>

    // DI
    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)
    protected readonly document = inject(DOCUMENT)
    protected readonly router = inject(Router)
    protected readonly activatedRoute = inject(ActivatedRoute)
    protected readonly epicSvtTestSetupConfigBodyDataFacade = inject(EpicSvtTestSetupConfigBodyDataFacade)
    protected readonly clipboard = inject(Clipboard)

    constructor() {
        super()
        const allTestSetups = this.store.selectSignal(StoreSelectors.selectAllTestSetups)
        const allTestSetupConfigs = this.store.selectSignal<EpicSvtTestSetupConfig[]>(StoreSelectors.selectAllTestSetupConfigs)

        this.testSetupConfig = computed<EpicSvtTestSetupConfig>(() => {
            return allTestSetupConfigs()?.find(item => item.id === +this.testSetupConfigId())
        })

        const testSetup = computed<EpicSvtTestSetup>(() => {
            return allTestSetups()?.find(item => item.id === this.testSetupConfig()?.setupId)
        })

        this.isDefault = computed(() => this.testSetupConfig()?.id === testSetup()?.defaultConfigId)

        this.testSetupConfigBody = computed(() => {
            return JSON.parse(this.testSetupConfigBodyResource.value()?.configBody ?? null)
        })

        this.testSetupConfigBodyResource = rxResource<EpicSvtTestSetupConfigBody, { testSetupConfigId: number }>({
            request: () => ({ testSetupConfigId: +this.testSetupConfigId() }),
            loader: ({ request }) => this.epicSvtTestSetupConfigBodyDataFacade.fetchData(request.testSetupConfigId),
        })

        // on config created, navigate to config details
        this.actions$
            .pipe(
                ofType(StoreActions.createConfigSuccessAction),
                takeUntil(this.destroyed$),
            )
            .subscribe(({ entity }) => {
                void this.router.navigate(['../', entity.id], { relativeTo: this.activatedRoute })
            })

    }

    onSetDefault(): void {
        this.store.dispatch(
            StoreActions.updateRequestAction({
                id: this.testSetupConfig().setupId,
                update: { defaultConfigId: this.testSetupConfig().id },
            }),
        )
    }

    onCopyToClipboard(): void {
        const configBodyString = JSON.stringify(this.testSetupConfigBody(), null, 4)
        this.clipboard.copy(configBodyString)
    }

    onDownloadJson(): void {
        const configBodyString = JSON.stringify(this.testSetupConfigBody(), null, 4)
        const blob = new Blob([configBodyString], { type: 'application/json' })
        const fileName = `${this.testSetupConfig()?.name.replace(/[^a-z0-9_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}.json`

        FileHelpers.saveBlobFile(blob, fileName, this.document)
    }

}
