import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, ContentChild, forwardRef, Input, OnInit } from '@angular/core'
import { FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms'
import { MatListOption, MatSelectionList } from '@angular/material/list'
import { TranslatePipe } from '@ngx-translate/core'
import { SelectOptionLabelValue } from 'epic-ui/utils'

import { EpicLongTextComponent } from '../../../long-text'
import { EpicNoResultModule } from '../../../no-result'
import { EpicSelectionListOptionDirective } from '../../directives'
import { EpicBaseSelectionListComponent } from '../base'


@Component({
    selector: 'epic-selection-list-virtual-scroll',
    templateUrl: './epic-selection-list-virtual-scroll.component.html',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => EpicSelectionListVirtualScrollComponent),
            multi: true,
        },
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        TranslatePipe,
        MatSelectionList,
        MatListOption,
        CdkVirtualForOf,
        CdkVirtualScrollViewport,
        CdkFixedSizeVirtualScroll,
        EpicNoResultModule,
        EpicLongTextComponent,
        FormsModule,
    ],
})
export class EpicSelectionListVirtualScrollComponent<TValue = unknown, TData = unknown>
    extends EpicBaseSelectionListComponent<TValue, TData>
    implements OnInit {

    @Input() selectOptions: SelectOptionLabelValue<TValue, TData>[] = []
    @Input() itemHeight = 44
    @Input() minBufferPx: number
    @Input() maxBufferPx: number

    @ContentChild(EpicSelectionListOptionDirective) customOptionTemplate: EpicSelectionListOptionDirective<TValue, TData>

}
