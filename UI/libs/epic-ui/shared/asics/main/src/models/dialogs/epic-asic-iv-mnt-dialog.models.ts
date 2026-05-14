import { EpicIvMnt } from 'epic-ui/api'
import { EpicIvMntNewForm } from 'epic-ui/shared/iv-mnt'

import Form = EpicIvMntNewForm


export namespace EpicAsicIvMntDialog {

    export type Data = {
        formData?: Partial<Form.FormValue>
        isClone?: boolean
        ivMnt?: EpicIvMnt
    }

}
