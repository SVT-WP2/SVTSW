import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'

import { EpicButtonGroupComponent } from './components'
import { EpicButtonStyleDirective, EpicButtonDirective } from './directives'


@NgModule({
    imports: [
        CommonModule,

        MatButtonModule,
        EpicButtonGroupComponent,
    ],
    declarations: [
        EpicButtonDirective,
        EpicButtonStyleDirective,
    ],
    exports: [
        EpicButtonDirective,
        EpicButtonStyleDirective,
        EpicButtonGroupComponent,
        MatButtonModule,
    ],
})
export class EpicButtonModule {
}
