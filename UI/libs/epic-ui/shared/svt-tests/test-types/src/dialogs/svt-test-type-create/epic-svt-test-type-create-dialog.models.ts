import { EpicSvtTestTypeCreateForm } from '../../forms'

import Form = EpicSvtTestTypeCreateForm


export namespace EpicSvtTestTypeCreateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
        isClone?: boolean
    }

}

