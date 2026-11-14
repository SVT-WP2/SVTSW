import { EpicWafer, EpicWaferType } from 'svt-ts-types'


export namespace EpicWaferDetailsDialog {

    export type Data = {
        wafer: EpicWafer
        waferType?: EpicWaferType
    }

}
