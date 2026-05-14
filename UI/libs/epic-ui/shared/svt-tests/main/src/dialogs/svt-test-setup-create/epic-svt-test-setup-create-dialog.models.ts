import { EpicSvtTestSetupCreateForm } from '../../forms'

import Form = EpicSvtTestSetupCreateForm


export namespace EpicSvtTestSetupCreateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
        isClone?: boolean
    }

}
