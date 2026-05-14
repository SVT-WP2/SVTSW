import { EpicSvtTestTypeConfigCreateForm } from '../../forms'

import Form = EpicSvtTestTypeConfigCreateForm


export namespace EpicSvtTestTypeConfigCreateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
        testTypeId: number
        isClone?: boolean
    }

}

