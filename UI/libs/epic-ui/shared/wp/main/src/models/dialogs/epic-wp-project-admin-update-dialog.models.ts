import { EpicWpProjectAdminUpdateForm } from '../forms'

import Form = EpicWpProjectAdminUpdateForm


export namespace EpicWpProjectAdminUpdateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
        isClone?: boolean
    }

}
