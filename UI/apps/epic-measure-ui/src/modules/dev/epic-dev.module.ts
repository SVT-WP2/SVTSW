import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatCardModule } from '@angular/material/card'
import { MatDivider } from '@angular/material/divider'
import { MatFormField } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { RouterModule } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { EpicNotificationModule, EpicSearchBoxModule, EpicTabsModule } from 'epic-ui/common/components'
import { EpicKafkaSendMessageFormComponent } from 'epic-ui/shared/kafka'
import { EpicTcpSendMessageFormComponent } from 'epic-ui/shared/tcp'
import { EpicSearchPipe } from 'epic-ui/utils'
import { MarkdownModule } from 'ngx-markdown'

import { EpicDevRoutingModule } from './epic-dev-routing.module'


@NgModule({
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        MarkdownModule.forRoot(),

        MatFormField,
        MatInputModule,
        MatCardModule,
        MatButton,
        MatDivider,
        TranslateModule,

        EpicSearchBoxModule,
        EpicTabsModule,
        EpicSearchPipe,
        EpicNotificationModule,

        EpicDevRoutingModule,
        EpicKafkaSendMessageFormComponent,
        EpicTcpSendMessageFormComponent,

    ],
    declarations: [
    ],
})
export class EpicDevModule {

}
