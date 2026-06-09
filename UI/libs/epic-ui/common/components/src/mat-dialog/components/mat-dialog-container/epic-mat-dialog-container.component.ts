import { Component, Input } from '@angular/core'
import { BaseComponent } from 'epic-ui/utils'


@Component({
    selector: 'epic-mat-dialog-container',
    templateUrl: './epic-mat-dialog-container.component.html',
    standalone: false,
})
export class EpicMatDialogContainerComponent extends BaseComponent {

    @Input() isFullScreenMode = false

}
