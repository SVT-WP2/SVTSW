import { Component, Input } from '@angular/core'


@Component({
    selector: 'epic-layout-light-header-title',
    templateUrl: './epic-layout-light-header-title.component.html',
    standalone: false,
})
export class EpicLayoutLightHeaderTitleComponent {

    @Input() subTitle: string

    readonly sectionAlias = 'HEADER_TITLE'

}
