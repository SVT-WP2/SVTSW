import { IsIP, IsNotEmpty } from 'class-validator'


export class EpicTcpSendMessageDto {

    @IsNotEmpty()
    @IsIP('4')
    ipAddress: string

    @IsNotEmpty()
    portNumber: number

    @IsNotEmpty()
    message: string

}
