import { Type } from '@angular/core'

import { EpicMatDialogContainerComponent } from './mat-dialog-container/epic-mat-dialog-container.component'
import { EpicMatDialogContentComponent } from './mat-dialog-content/epic-mat-dialog-content.component'
import { EpicMatDialogContentSidebarComponent } from './mat-dialog-content-sidebar/epic-mat-dialog-content-sidebar.component'
import { EpicMatDialogHeaderComponent } from './mat-dialog-header/epic-mat-dialog-header.component'
import { EpicMatDialogHeaderSubtitleComponent } from './mat-dialog-header-subtitle/epic-mat-dialog-header-subtitle.component'


export const epicDialogComponents: Type<any>[] = [
    EpicMatDialogHeaderComponent,
    EpicMatDialogContainerComponent,
    EpicMatDialogContentComponent,
    EpicMatDialogContentSidebarComponent,
    EpicMatDialogHeaderSubtitleComponent,
]

export * from './public-api'
