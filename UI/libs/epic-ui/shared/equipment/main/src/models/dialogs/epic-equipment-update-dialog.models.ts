import { EpicEquipmentUpdateForm } from '../forms'

import Form = EpicEquipmentUpdateForm


export namespace EpicEquipmentUpdateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
        isClone?: boolean
    }

}
