import { EpicAsicUpdateForm } from '../forms'


import Form = EpicAsicUpdateForm


export namespace EpicWaferUpdateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
        isClone?: boolean
    }

}
