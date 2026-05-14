import { Component, Input } from '@angular/core'


@Component({
    selector: 'epic-layout-light-header-actions',
    templateUrl: './epic-layout-light-header-actions.component.html',
    standalone: false,
})
export class EpicLayoutLightHeaderActionsComponent {

    @Input() order = 1
    @Input() multiple = true
    @Input() alias: string

}
