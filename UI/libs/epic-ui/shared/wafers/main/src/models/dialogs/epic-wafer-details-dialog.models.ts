import { EpicWafer, EpicWaferType } from 'epic-ui/api'


export namespace EpicWaferDetailsDialog {

    export type Data = {
        wafer: EpicWafer
        waferType?: EpicWaferType
    }

}
