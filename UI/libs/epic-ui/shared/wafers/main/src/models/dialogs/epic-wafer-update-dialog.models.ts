import { EpicWaferUpdateForm } from '../forms'


import Form = EpicWaferUpdateForm


export namespace EpicWaferUpdateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
        isClone?: boolean
    }

}
