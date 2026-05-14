import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButton, MatIconButton } from '@angular/material/button'
import { MatCardModule } from '@angular/material/card'
import { MatDivider } from '@angular/material/divider'
import { MatFormField } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatTooltip } from '@angular/material/tooltip'
import { RouterModule } from '@angular/router'
import {
    EpicIconComponent,
    EpicBreadcrumbsModule,
    EpicButtonModule,
    EpicContentErrorModule,
    EpicLoaderComponent,
    EpicNotificationModule, EpicContentErrorMessagePipe,
} from 'epic-ui/common/components'
import { EpicLayoutLightModule } from 'epic-ui/common/layout'
import { EpicIvMntContainerComponent, EpicIvMntGridComponent, EpicIvMntNewFormComponent } from 'epic-ui/shared/iv-mnt'
import { EpicKafkaSendMessageFormComponent } from 'epic-ui/shared/kafka'
import { EpicTcpSendMessageFormComponent } from 'epic-ui/shared/tcp'
import { EpicWafersListComponent } from 'epic-ui/shared/wafers'


import { EpicIvMntRoutingModule } from './epic-iv-mnt-routing.module'
import { EpicIvMntListPageComponent, EpicIvMntNewPageComponent } from './pages'


@NgModule({
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,

        MatFormField,
        MatInputModule,
        MatButton,
        MatCardModule,
        MatIconButton,
        MatDivider,
        MatTooltip,

        EpicIvMntRoutingModule,
        EpicKafkaSendMessageFormComponent,
        EpicTcpSendMessageFormComponent,
        EpicIvMntGridComponent,
        EpicIvMntNewFormComponent,
        EpicIvMntContainerComponent,
        EpicWafersListComponent,
        EpicLayoutLightModule,
        EpicIconComponent,
        EpicButtonModule,
        EpicLoaderComponent,
        EpicContentErrorModule,
        EpicBreadcrumbsModule,
        EpicNotificationModule,
        EpicContentErrorMessagePipe,

    ],
    declarations: [
        EpicIvMntListPageComponent,
        EpicIvMntNewPageComponent,
    ],
})
export class EpicIvMntModule {

}
