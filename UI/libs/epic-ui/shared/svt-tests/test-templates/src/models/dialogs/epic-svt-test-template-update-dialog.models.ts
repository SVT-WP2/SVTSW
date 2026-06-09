import { EpicSvtTestTemplateUpdateForm } from '../forms'

import Form = EpicSvtTestTemplateUpdateForm


export namespace EpicSvtTestTemplateUpdateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
        isClone?: boolean
    }

}

