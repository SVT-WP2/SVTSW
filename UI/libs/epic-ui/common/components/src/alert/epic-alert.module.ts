import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'

import { EpicAlertComponent } from './components'
import {
    EpicAlertActionDirective,
    EpicAlertIconDirective,
} from './directives'


@NgModule({
    imports: [
        CommonModule,
    ],
    declarations: [
        EpicAlertComponent,
        EpicAlertActionDirective,
        EpicAlertIconDirective,
    ],
    exports: [
        EpicAlertComponent,
        EpicAlertActionDirective,
        EpicAlertIconDirective,
    ],
})
export class EpicAlertModule {
}
