import { NgTemplateOutlet } from '@angular/common'
import { Component, ContentChild, forwardRef, Input } from '@angular/core'
import { FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms'
import { MatListOption, MatSelectionList } from '@angular/material/list'
import { TranslatePipe } from '@ngx-translate/core'
import { SelectOptionLabelValue } from 'epic-ui/utils'

import { EpicLongTextComponent } from '../../../long-text'
import { EpicNoResultModule } from '../../../no-result'
import { EpicSelectionListOptionDirective } from '../../directives'
import { EpicBaseSelectionListComponent } from '../base'


@Component({
    selector: 'epic-selection-list',
    templateUrl: './epic-selection-list.component.html',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => EpicSelectionListComponent),
            multi: true,
        },
    ],
    imports: [
        NgTemplateOutlet,
        TranslatePipe,
        FormsModule,
        MatSelectionList,
        MatListOption,
        EpicLongTextComponent,
        EpicNoResultModule,
    ],
})
export class EpicSelectionListComponent<TValue = unknown, TData = unknown>
    extends EpicBaseSelectionListComponent<TValue | TValue[], TData> {

    @Input() selectOptions: SelectOptionLabelValue<TValue, TData>[] = []

    @ContentChild(EpicSelectionListOptionDirective) customOptionTemplate: EpicSelectionListOptionDirective<TValue, TData>


}
