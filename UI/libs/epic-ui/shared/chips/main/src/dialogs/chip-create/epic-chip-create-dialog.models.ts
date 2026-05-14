import { EpicChipCreateForm } from '../../forms'

import Form = EpicChipCreateForm


export namespace EpicChipCreateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
    }

}
