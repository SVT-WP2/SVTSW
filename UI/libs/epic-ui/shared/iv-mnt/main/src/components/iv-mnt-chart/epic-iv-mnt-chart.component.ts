import { Component, computed, input } from '@angular/core'
import { AgGridModule } from 'ag-grid-angular'
import { ECharts, EChartsCoreOption } from 'echarts/core'
import { EpicIvDataRecord } from 'epic-ui/api'
import { BaseComponent } from 'epic-ui/utils'
import { NgxEchartsDirective } from 'ngx-echarts'

import { EpicIvMntChart } from '../../models'


@Component({
    selector: 'epic-iv-mnt-chart',
    templateUrl: 'epic-iv-mnt-chart.component.html',
    standalone: true,
    imports: [
        AgGridModule,
        NgxEchartsDirective,
    ],
})
export class EpicIvMntChartComponent extends BaseComponent {

    // INPUTS
    readonly data = input.required<EpicIvDataRecord[]>()

    readonly chartOptions = computed<EChartsCoreOption>(() => {
        return EpicIvMntChart.getEChartsOptions(this.data())
    })

    chart: ECharts

    onChartInit(chart: ECharts): void {
        this.chart = chart
    }

}
