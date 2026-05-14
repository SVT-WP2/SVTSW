import { EChartsCoreOption } from 'echarts/core'
import { DEFAULT_SYSTEM_COLORS } from 'epic-ui/utils/colors'


export namespace EpicWaferTestProgress {

    export function calculateEchartsOption(
        currentOutputPercentage: number,
        color: string = DEFAULT_SYSTEM_COLORS.PRIMARY_300,
        bgColor: string = DEFAULT_SYSTEM_COLORS.PRIMARY_50): EChartsCoreOption {

        return {
            grid: {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
            },
            series: [
                {
                    type: 'gauge',
                    startAngle: 90,
                    endAngle: -270,
                    pointer: {
                        show: false,
                    },
                    silent: true,
                    radius: '100%',
                    progress: {
                        show: true,
                        overlap: false,
                        roundCap: false,
                        clip: false,
                        itemStyle: {
                            color: color,
                        },
                    },
                    axisLine: {
                        lineStyle: {
                            color: [[0, bgColor], [100, bgColor]],
                        },
                    },
                    splitLine: {
                        show: false,
                    },
                    axisTick: {
                        show: false,
                    },
                    axisLabel: {
                        show: false,
                    },
                    data: [currentOutputPercentage],
                    title: {
                        show: false,
                    },
                    detail: {
                        show: false,
                    },
                },
            ],
        }
    }

}
