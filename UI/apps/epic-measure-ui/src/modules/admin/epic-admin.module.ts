import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton, MatIconButton } from '@angular/material/button'
import { MatCardModule } from '@angular/material/card'
import { MatDivider } from '@angular/material/divider'
import { MatFormField } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu'
import { MatTooltipModule } from '@angular/material/tooltip'
import { RouterModule } from '@angular/router'
import { AgIconActionsCellModule, EpicAgGridCardHeaderComponent, EpicAgGridCardWrapperComponent } from 'epic-ui/common/ag-grid'
import {
    EpicButtonModule,
    EpicIconComponent,
    EpicLoaderComponent,
    EpicBreadcrumbsModule,
    EpicContentErrorModule,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { EpicAsicsListComponent } from 'epic-ui/shared/asics'
import { EpicKafkaSendMessageFormComponent } from 'epic-ui/shared/kafka'
import { EpicTcpSendMessageFormComponent } from 'epic-ui/shared/tcp'
import { EpicWaferAsicsListComponent, EpicWaferInfoComponent, EpicWafersListComponent } from 'epic-ui/shared/wafers'
import { MarkdownModule } from 'ngx-markdown'

import { EpicAdminRoutingModule } from './epic-admin-routing.module'


@NgModule({
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,

        MatFormField,
        MatInputModule,
        MatButton,
        MatCardModule,
        MatTooltipModule,
        MatMenu,
        MatMenuItem,
        MatMenuTrigger,
        MatDivider,
        MatIconButton,

        EpicAdminRoutingModule,
        EpicKafkaSendMessageFormComponent,
        EpicTcpSendMessageFormComponent,
        EpicWafersListComponent,
        EpicLayoutLightModule,
        EpicLoaderComponent,
        EpicContentErrorModule,
        EpicBreadcrumbsModule,
        EpicIconComponent,
        EpicButtonModule,
        EpicWaferInfoComponent,
        EpicAsicsListComponent,
        EpicWaferAsicsListComponent,
        EpicAgGridCardWrapperComponent,
        EpicAgGridCardHeaderComponent,
        AgIconActionsCellModule,
        MarkdownModule.forRoot(),
    ],
    declarations: [],
    providers: [],
})
export class EpicAdminModule {

}
