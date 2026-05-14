import { LineSeriesOption } from 'echarts/charts'
import { EChartsCoreOption } from 'echarts/core'
import { EpicIvDataRecord } from 'epic-ui/api'
import { DEFAULT_SYSTEM_COLORS } from 'epic-ui/utils/colors'


export namespace EpicIvMntChart {

    export function getEChartsOptions(data: EpicIvDataRecord[]): EChartsCoreOption {
        return {
            legend: {
                show: false,
            },
            grid: {
                top: 8,
                bottom: 32,
                left: 48,
                right: 0,
                containLabel: true,
            },
            animation: false,
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                },
                appendTo: 'body',
                confine: true,
                formatter: (series) => {
                    const currentSeries = series[0]
                    // let result = `<b>${currentSeries.axisValueLabel} V</b><br/>`
                    const result = `<div class="d-flex align-items-center w-100">
                            ${currentSeries.marker as string}
                            <div class="flex-1 text-start pe-3 ps-1">${currentSeries.axisValueLabel} V</div>
                            <div class="flex-1 text-end"><b>${currentSeries.value.toExponential()} A</b></div>
                        </div>`
                    return result
                },
            },
            xAxis: {
                type: 'category',
                show: true,
                data: data.map(item => item.voltage),
                nameLocation: 'middle',
                nameGap: 32,
                name: 'Voltage [V]',
            },
            yAxis: {
                type: 'value',
                show: true,
                axisLabel: {
                    formatter: (value) => `${(Number(value)).toExponential()}`,
                },
                nameLocation: 'middle',
                nameGap: 48,
                name: 'Current [A]',
            },
            series: [{
                type: 'line',
                color: DEFAULT_SYSTEM_COLORS.PRIMARY_300,
                emphasis: {
                    focus: 'none',
                },
                symbol: 'circle',
                data: data.map(item => item.current),
            }] as LineSeriesOption,
        }
    }

}
