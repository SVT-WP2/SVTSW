import { EpicWaferTestUpdateForm } from '../forms'

import Form = EpicWaferTestUpdateForm


export namespace EpicWaferTestUpdateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
        isClone?: boolean
    }

}
