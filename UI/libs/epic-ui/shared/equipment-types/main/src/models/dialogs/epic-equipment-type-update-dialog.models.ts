import { EpicEquipmentTypeUpdateForm } from '../forms'

import Form = EpicEquipmentTypeUpdateForm


export namespace EpicEquipmentTypeUpdateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
        isClone?: boolean
    }

}
