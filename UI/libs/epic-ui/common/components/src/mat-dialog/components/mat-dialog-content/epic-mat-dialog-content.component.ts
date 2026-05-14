import { Component, ContentChildren, QueryList, TemplateRef } from '@angular/core'
import { BaseComponent } from 'epic-ui/utils'

import { EpicMatDialogContentSidebarComponent } from '../mat-dialog-content-sidebar/epic-mat-dialog-content-sidebar.component'


@Component({
    selector: 'epic-mat-dialog-content',
    templateUrl: './epic-mat-dialog-content.component.html',
    standalone: false,
})
export class EpicMatDialogContentComponent extends BaseComponent {

    @ContentChildren(EpicMatDialogContentSidebarComponent) sidebarChildren!: QueryList<EpicMatDialogContentSidebarComponent>

    footerTemplatesRef?: TemplateRef<any> | null

    footerActionsTemplatesRef?: TemplateRef<any> | null

    constructor(
    ) {
        super()
    }

}
