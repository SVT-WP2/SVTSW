import { EpicWafer, EpicWaferType } from 'epic-api-types'


export namespace EpicWaferDetailsDialog {

    export type Data = {
        wafer: EpicWafer
        waferType?: EpicWaferType
    }

}
