import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling'
import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, ContentChild, forwardRef, Input, OnInit } from '@angular/core'
import { FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms'
import { MatListOption, MatSelectionList } from '@angular/material/list'
import { TranslatePipe } from '@ngx-translate/core'
import { SelectOptionLabelValue } from 'epic-ui/utils'

import { EpicLongTextComponent } from '../../../long-text'
import { EpicNoResultModule } from '../../../no-result'
import {
    IEpicScrollingDataSource,
    EpicInfiniteScrollContentComponent,
    EpicScrollingDataSourceInfiniteScrollContentDirective,
    EpicScrollingDataSourceVirtualScrollViewportDirective,
} from '../../../scrolling'
import { EpicSelectionListOptionDirective } from '../../directives'
import { EpicBaseSelectionListComponent } from '../base'


@Component({
    selector: 'epic-selection-list-infinite-scroll',
    templateUrl: './epic-selection-list-infinite-scroll.component.html',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => EpicSelectionListInfiniteScrollComponent),
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
        CdkFixedSizeVirtualScroll,
        CdkVirtualForOf,
        CdkVirtualScrollViewport,
        EpicNoResultModule,
        EpicInfiniteScrollContentComponent,
        EpicScrollingDataSourceVirtualScrollViewportDirective,
        EpicScrollingDataSourceInfiniteScrollContentDirective,
        EpicLongTextComponent,
        FormsModule,
    ],
})
export class EpicSelectionListInfiniteScrollComponent<TValue = unknown, TData = unknown>
    extends EpicBaseSelectionListComponent<TValue, TData>
    implements OnInit {

    @Input({ required: true }) dataSource: IEpicScrollingDataSource<SelectOptionLabelValue<TValue, TData>>
    @Input() initAutoFetchData = true
    @Input() itemHeight = 44
    @Input() minBufferPx: number
    @Input() maxBufferPx: number

    @ContentChild(EpicSelectionListOptionDirective) customOptionTemplate: EpicSelectionListOptionDirective<TValue, TData>

}
