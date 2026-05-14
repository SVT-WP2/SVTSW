import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { TranslateModule } from '@ngx-translate/core'
import { ToastrModule } from 'ngx-toastr'

import { EpicButtonModule } from '../button'
import { EpicIconComponent } from '../icon'

import { EpicToastRendererComponent } from './components'


// TODO: move notifications out of share/components to just shared as a new entry point

@NgModule({
    imports: [
        CommonModule,
        TranslateModule,

        MatButtonModule,
        ToastrModule.forRoot({
            tapToDismiss: false,
            positionClass: 'toast-bottom-left',
            toastComponent: EpicToastRendererComponent,
        }),
        EpicButtonModule,
        EpicIconComponent,
    ],
    declarations: [
        EpicToastRendererComponent,
    ],
    providers: [],
    exports: [
        ToastrModule,
        EpicToastRendererComponent,
    ],
})
export class EpicNotificationModule { }
