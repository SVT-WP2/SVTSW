import { EpicInstConnectionType, EpicIvDataRecord, EpicIvMnt, EpicMntStatus, EpicSourceMeterType } from 'epic-ui/api'
import { DateTimeHelpers } from 'epic-ui/utils'
import moment from 'moment'


export namespace EpicAsicsIvMntStoreMock {

    export function getAsicIvMntList(): EpicIvMnt[] {
        return [
            generateIvMnt('1'),
            generateIvMnt('2'),
            {
                ...generateIvMnt('3'),
                status: EpicMntStatus.Aborted,
            },
            {
                ...generateIvMnt('4'),
                status: EpicMntStatus.Error,
            },
            {
                ...generateIvMnt('5'),
                name: 'IV - long ramp',
            },
            {
                ...generateIvMnt('6'),
                name: '1000V => 0V',
            },
            {
                ...generateIvMnt('7'),
                name: '0 => 1000V',
            },
        ]
    }

    export function generateIvMnt(id: string, extra?: Partial<EpicIvMnt>): EpicIvMnt {
        const refDate = moment().add(-Math.round(Math.random() * 10), 'day')
        const record = {
            id,
            name: 'IV - breakdown',
            labels: [],
            data: [],
            status: EpicMntStatus.Done,
            createdAt: refDate.format(DateTimeHelpers.FULL_DATE_TIME),
            updatedAt: refDate.format(DateTimeHelpers.FULL_DATE_TIME),
            startedAt: refDate.format(DateTimeHelpers.FULL_DATE_TIME),
            finishedAt: refDate.add(2, 'minutes').format(DateTimeHelpers.FULL_DATE_TIME),
            isActive: true,
            settings: {
                voltageStart: 0,
                voltageStop: 20,
                voltageStep: 5,
                sweepDelayInMs: 500,
                initDelayInMs: 1000,
                complianceInA: 1e-5,
            },
            sourceMeterConfig: {
                connectionType: EpicInstConnectionType.None,
                instrumentType: EpicSourceMeterType.FakeSource,
            },
            ...(extra || {}),
        }

        record.data = generateData(record.settings.voltageStart, record.settings.voltageStep, record.settings.voltageStop)
        return record
    }

    export function generateData(voltageStart: number, voltageStep: number, voltageStop: number): EpicIvDataRecord[] {
        const data: EpicIvDataRecord[] = []
        let currenVoltage = voltageStart
        while (currenVoltage < voltageStop) {
            data.push({
                current: Math.random() * 1e-6 + Math.random() * 6e-6,
                voltage: data.length
                    ? currenVoltage
                    : voltageStart,
            })
            currenVoltage += voltageStep
        }

        return data
    }

}
