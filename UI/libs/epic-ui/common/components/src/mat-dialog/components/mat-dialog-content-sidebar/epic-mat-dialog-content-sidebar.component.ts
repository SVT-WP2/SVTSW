import { Component, Input } from '@angular/core'
import { BaseComponent } from 'epic-ui/utils'


@Component({
    selector: 'epic-mat-dialog-content-sidebar',
    templateUrl: './epic-mat-dialog-content-sidebar.component.html',
    standalone: false,
})
export class EpicMatDialogContentSidebarComponent extends BaseComponent {

    @Input() sidebarTitle?: string

}
