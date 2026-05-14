import { Component, Input } from '@angular/core'
import { BaseComponent } from 'epic-ui/utils'


@Component({
    selector: 'epic-mat-dialog-header',
    templateUrl: './epic-mat-dialog-header.component.html',
    standalone: false,
})
export class EpicMatDialogHeaderComponent extends BaseComponent {

    @Input() headerIconName?: string

    @Input() showCloseButton = true

}
