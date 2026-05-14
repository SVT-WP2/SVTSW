import { IsIP, IsNotEmpty } from 'class-validator'


export class EpicTcpReadMessageDto {

    @IsNotEmpty()
    @IsIP('4')
    ipAddress: string

    @IsNotEmpty()
    portNumber: number

}
