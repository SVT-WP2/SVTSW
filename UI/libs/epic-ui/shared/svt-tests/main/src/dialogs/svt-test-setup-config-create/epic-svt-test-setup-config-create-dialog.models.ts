import { EpicSvtTestSetupConfigCreateForm } from '../../forms'

import Form = EpicSvtTestSetupConfigCreateForm


export namespace EpicSvtTestSetupConfigCreateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
        testSetupId: number
        isClone?: boolean
    }

}
