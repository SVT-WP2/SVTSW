import { EpicWaferTypeUpdateForm } from '../forms'

import Form = EpicWaferTypeUpdateForm


export namespace EpicWaferTypeUpdateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
        isClone?: boolean
    }

}
