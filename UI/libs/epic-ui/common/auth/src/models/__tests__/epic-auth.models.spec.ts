import { EpicAuth } from '../epic-auth.models'


describe('EpicAuth', () => {
    
    describe('comparePassword', () => {
        const testCases: string[] = [
            'password#1',
            'Password!123_^',
        ]
        
        it.each(testCases)('', (password: string) => {
            const hash = EpicAuth.hashPassword(password)
            const compare = EpicAuth.comparePassword(hash, password)
            expect(compare).toBeTruthy()
        })
    })
    
})
