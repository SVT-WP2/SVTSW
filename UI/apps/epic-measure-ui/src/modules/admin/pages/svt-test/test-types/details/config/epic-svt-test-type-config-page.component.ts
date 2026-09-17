import { Clipboard } from '@angular/cdk/clipboard'
import { ChangeDetectionStrategy, Component, computed, DOCUMENT, effect, inject, input, ResourceRef, Signal } from '@angular/core'
import { rxResource } from '@angular/core/rxjs-interop'
import { MatCardModule } from '@angular/material/card'
import { ActivatedRoute, Router } from '@angular/router'
import { Actions, ofType } from '@ngrx/effects'
import { Store } from '@ngrx/store'
import { EpicSvtTestType, EpicSvtTestTypeConfig, EpicSvtTestTypeConfigBody } from 'epic-ui/api'
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
import { EpicSvtTestTypeConfigBodyDataFacade, EpicSvtTestTypesActions, EpicSvtTestTypesSelectors } from 'epic-ui/shared/svt-test/test-types'
import { BaseComponent, FileHelpers, StringHelpers } from 'epic-ui/utils'
import { AceModule } from 'ngx-ace-wrapper'
import { takeUntil } from 'rxjs'

import 'brace/mode/hjson'
import StoreSelectors = EpicSvtTestTypesSelectors
import StoreActions = EpicSvtTestTypesActions


@Component({
    selector: 'epic-svt-test-type-config-page',
    templateUrl: 'epic-svt-test-type-config-page.component.html',
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
export class EpicSvtTestTypeConfigPageComponent extends BaseComponent {

    readonly testTypeConfigId = input<string>()
    readonly testTypeConfig: Signal<EpicSvtTestTypeConfig>
    readonly testTypeConfigBodyResource: ResourceRef<EpicSvtTestTypeConfigBody>
    readonly testTypeConfigBody: Signal<string>
    readonly testType: Signal<EpicSvtTestType>

    // DI
    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)
    protected readonly document = inject(DOCUMENT)
    protected readonly router = inject(Router)
    protected readonly activatedRoute = inject(ActivatedRoute)
    protected readonly epicSvtTestTypeConfigBodyDataFacade = inject(EpicSvtTestTypeConfigBodyDataFacade)
    protected readonly clipboard = inject(Clipboard)

    private readonly allTestTypeConfigs: Signal<EpicSvtTestTypeConfig[]>

    constructor() {
        super()
        this.testType = this.store.selectSignal<EpicSvtTestType>(StoreSelectors.selectActiveTestType)
        this.allTestTypeConfigs = this.store.selectSignal<EpicSvtTestTypeConfig[]>(StoreSelectors.selectActiveTestTypeConfigs)
        this.testTypeConfig = computed<EpicSvtTestTypeConfig>(() => {
            return this.allTestTypeConfigs()?.find(item => item.id === +this.testTypeConfigId())
        })

        this.testTypeConfigBody = computed(() => {
            return this.testTypeConfigBodyResource.value()?.configBody ?? ''
        })

        this.testTypeConfigBodyResource = rxResource<EpicSvtTestTypeConfigBody, { testTypeConfigId: number }>({
            params: () => ({ testTypeConfigId: +this.testTypeConfigId() }),
            stream: ({ params }) => this.epicSvtTestTypeConfigBodyDataFacade.fetchData(params.testTypeConfigId),
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

        effect(() => {
            if (!this.testTypeConfigId() || (this.allTestTypeConfigs()?.length && !this.testTypeConfig())) {
                void this.router.navigate(['../', this.allTestTypeConfigs()[0].id], { relativeTo: this.activatedRoute, replaceUrl: true })
            }
        })

    }

    onCopyToClipboard(): void {
        this.clipboard.copy(this.testTypeConfigBody())
    }

    onDownloadFile(): void {
        const configBody = this.testTypeConfigBody()
        const isJson = StringHelpers.isJsonString(configBody)
        const blob = new Blob([configBody], { type: isJson ? 'application/json' : 'text/plain' })
        const name = this.testTypeConfig()?.name.replace(/[^a-z0-9_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
        const fileName = `${name}.${isJson ? 'json' : 'txt'}`

        FileHelpers.saveBlobFile(blob, fileName, this.document)
    }

}
