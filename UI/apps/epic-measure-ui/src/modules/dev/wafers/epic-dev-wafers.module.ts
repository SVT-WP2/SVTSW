import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MatCardModule } from '@angular/material/card'
import { MatDialogModule } from '@angular/material/dialog'
import { MatDivider } from '@angular/material/divider'
import { MatFormField } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { RouterModule } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { EpicIconComponent, EpicNotificationModule, EpicSearchBoxModule, EpicTabsModule } from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { EpicKafkaSendMessageFormComponent } from 'epic-ui/shared/kafka'
import { EpicTcpSendMessageFormComponent } from 'epic-ui/shared/tcp'
import { EpicWaferUpdateFormComponent } from 'epic-ui/shared/wafers'
import { EpicSearchPipe } from 'epic-ui/utils'
import { MarkdownModule } from 'ngx-markdown'

import { EpicDevWafersRoutingModule } from './epic-dev-wafers-routing.module'


@NgModule({
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        MarkdownModule,

        MatFormField,
        MatInputModule,
        MatCardModule,
        MatButton,
        MatDivider,
        MatDialogModule,
        TranslateModule,

        EpicLayoutLightModule,
        EpicSearchBoxModule,
        EpicTabsModule,
        EpicSearchPipe,
        EpicNotificationModule,

        EpicDevWafersRoutingModule,
        EpicKafkaSendMessageFormComponent,
        EpicTcpSendMessageFormComponent,
        EpicWaferUpdateFormComponent,
        EpicIconComponent,
    ],
    declarations: [
    ],
})
export class EpicDevWafersModule {

}
