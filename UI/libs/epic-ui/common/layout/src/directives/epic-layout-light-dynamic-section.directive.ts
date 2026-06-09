import { AfterViewInit, Directive, forwardRef, Inject, Input, OnDestroy, TemplateRef } from '@angular/core'
import { StringHelpers } from 'epic-ui/utils'

import { EpicLayoutLightComponent } from '../components/layout/epic-layout-light.component'
import { EpicLayoutLightDynamicSection } from '../models'


@Directive({
    selector: '[epicLayoutLightDynamicSection]',
    standalone: false,
})
export class EpicLayoutLightDynamicSectionDirective implements AfterViewInit, OnDestroy {

    @Input() epicLayoutLightDynamicSection: EpicLayoutLightDynamicSection.SectionName

    @Input() alias: string
    @Input() order: number
    @Input() multiple = true

    readonly id: string

    constructor(
        readonly template: TemplateRef<any>,
        @Inject(forwardRef(() => EpicLayoutLightComponent)) private readonly epicLayoutLightComponent: EpicLayoutLightComponent,
    ) {

        this.id = StringHelpers.guid()

    }

    ngAfterViewInit(): void {
        this.registerTemplate()
    }

    ngOnDestroy(): void {
        this.unregisterTemplate()
    }

    protected registerTemplate(): void {
        this.epicLayoutLightComponent.registerDynamicSection(
            this.epicLayoutLightDynamicSection,
            {
                id: this.id,
                template: this.template,
                order: this.order,
                alias: this.alias,
            },
            this.multiple,
        )

        this.epicLayoutLightComponent.changeDetectorRef.detectChanges()
    }

    protected unregisterTemplate(): void {
        this.epicLayoutLightComponent.unregisterDynamicSection(
            this.epicLayoutLightDynamicSection,
            this.id,
        )
    }

}
