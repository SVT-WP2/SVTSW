import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'

import { EpicInlineFilterComponent, EpicInlineFilterWithDialogComponent, EpicInlineFilterWithOverlayComponent } from './components'


@NgModule({
    imports: [
        CommonModule,
        EpicInlineFilterComponent,
        EpicInlineFilterWithOverlayComponent,
        EpicInlineFilterWithDialogComponent,
    ],
    declarations: [
    ],
    exports: [
        EpicInlineFilterComponent,
        EpicInlineFilterWithOverlayComponent,
        EpicInlineFilterWithDialogComponent,
    ],
})
export class EpicInlineFilterModule {
}
