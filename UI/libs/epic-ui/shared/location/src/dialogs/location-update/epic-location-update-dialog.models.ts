import { EpicLocationUpdateForm } from '../../forms'

import Form = EpicLocationUpdateForm


export namespace EpicLocationUpdateDialog {

    export type Data = {
        dialogTitle: string
        formData?: Partial<Form.FormData>
        formOptions?: Form.FormOptions
        submitBtnText?: string
    }

}
