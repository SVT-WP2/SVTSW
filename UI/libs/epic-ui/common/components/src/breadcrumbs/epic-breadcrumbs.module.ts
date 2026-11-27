import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { MatTooltipModule } from '@angular/material/tooltip'
import { RouterLink } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'

// Relative, not the barrel of this lib: the barrel loads this file before the icon and the long text, so under JIT
// (the unit tests) both would still be undefined here.
import { EpicIconComponent } from '../icon'
import { EpicLongTextComponent } from '../long-text'

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
