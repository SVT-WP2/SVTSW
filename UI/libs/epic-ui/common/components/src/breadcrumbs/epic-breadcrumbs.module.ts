import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatTooltipModule } from '@angular/material/tooltip'
import { RouterLink } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { EpicIconComponent, EpicLongTextComponent } from 'epic-ui/common/components'


import { EpicBreadcrumbsComponent, EpicBreadcrumbsSkeletonComponent } from './components'


@NgModule({
    imports: [
        // NG
        CommonModule,
        TranslateModule,
        RouterLink,
        // 3rd
        MatTooltipModule,
        MatButtonModule,
        // EPIC
        EpicLongTextComponent,
        EpicIconComponent,
    ],
    declarations: [
        EpicBreadcrumbsComponent,
        EpicBreadcrumbsSkeletonComponent,
    ],
    exports: [
        EpicBreadcrumbsComponent,
        EpicBreadcrumbsSkeletonComponent,
    ],
})
export class EpicBreadcrumbsModule {
}
