import { DOCUMENT } from '@angular/common'
import { ChangeDetectorRef, Component, Inject, Input, OnInit } from '@angular/core'
import { DynamicSection } from 'epic-ui/utils'

import { EpicLayoutLightDynamicSection } from '../../models'


@Component({
    selector: 'epic-layout-light',
    templateUrl: './epic-layout-light.component.html',
    standalone: false,
})
export class EpicLayoutLightComponent implements OnInit {

    @Input() environmentName: string

    dynamicSectionsCollection: DynamicSection.SectionsCollection = { current: {}, parents: {} }

    readonly SectionName = EpicLayoutLightDynamicSection.SectionName

    constructor(
        readonly changeDetectorRef: ChangeDetectorRef,
        @Inject(DOCUMENT) private readonly document: Document,
    ) {
    }

    ngOnInit(): void {
        this.document.body.classList.add('epic-layout-light-layout-body')
    }

    registerDynamicSection(
        sectionName: EpicLayoutLightDynamicSection.SectionName,
        sectionInfo: DynamicSection.SectionInfo,
        multiple = true): void {

        this.dynamicSectionsCollection = DynamicSection.registerSection(
            this.dynamicSectionsCollection,
            sectionName,
            sectionInfo,
            multiple,
        )
    }

    unregisterDynamicSection(sectionName: EpicLayoutLightDynamicSection.SectionName, sectionId: string): void {
        this.dynamicSectionsCollection = DynamicSection.unregisterSection(
            this.dynamicSectionsCollection,
            sectionName,
            sectionId,
        )
    }

}
