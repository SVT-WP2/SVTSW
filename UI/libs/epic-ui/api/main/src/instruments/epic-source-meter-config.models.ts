import { EpicGpibConnectionConfig } from './epic-gpib-connection-config.models'
import { EpicInstConnectionType } from './epic-inst-connection-type.models'
import { EpicSourceMeterType } from './epic-source-meter-type.models'
import { EpicTcpConnectionConfig } from './epic-tcp-connection-config.models'


export type EpicSourceMeterConfig = {
    instrumentType: EpicSourceMeterType
    connectionType: EpicInstConnectionType
    gpibConnectionConfig?: EpicGpibConnectionConfig
    tcpConnectionConfig?: EpicTcpConnectionConfig
}
