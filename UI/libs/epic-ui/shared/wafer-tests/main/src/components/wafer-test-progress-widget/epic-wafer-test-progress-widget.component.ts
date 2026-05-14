import { Component, computed, input } from '@angular/core'
import { EChartsCoreOption } from 'echarts/core'
import { EpicButtonModule, EpicLabelModule } from 'epic-ui/common/components'
import { BaseComponent } from 'epic-ui/utils'
import { NgxEchartsDirective } from 'ngx-echarts'

import { EpicWaferTestProgress } from '../../models'


@Component({
    selector: 'epic-wafer-test-progress-widget',
    templateUrl: 'epic-wafer-test-progress-widget.component.html',
    standalone: true,
    imports: [
        EpicButtonModule,
        EpicLabelModule,
        NgxEchartsDirective,
    ],
})
export class EpicWaferTestProgressWidgetComponent extends BaseComponent {

    readonly progressPercentage = input.required<number>()

    readonly echartsOption = computed<EChartsCoreOption>(() =>
        EpicWaferTestProgress.calculateEchartsOption(this.progressPercentage()),
    )

}
