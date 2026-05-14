import { EpicWpMachineUpdateForm } from '../forms'

import Form = EpicWpMachineUpdateForm


export namespace EpicWpMachineUpdateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
        isClone?: boolean
    }

}
