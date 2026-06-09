import { Component, Input } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { TranslateModule } from '@ngx-translate/core'

import { EpicDotDividerComponent } from '../../../dot-divider'
import { EpicExpandIconDirective, EpicIconComponent } from '../../../icon'


@Component({
    selector: 'epic-inline-filter',
    templateUrl: './epic-inline-filter.component.html',
    imports: [
        TranslateModule,
        MatButtonModule,
        EpicIconComponent,
        EpicDotDividerComponent,
        EpicExpandIconDirective,
    ],
})
export class EpicInlineFilterComponent {

    @Input() icon: string
    @Input() isIconOnly = false
    @Input() label: string
    @Input() disabled: boolean
    @Input() isActive: boolean
    @Input() isOpened: boolean
    @Input() selectedItemsNumber: number

}
