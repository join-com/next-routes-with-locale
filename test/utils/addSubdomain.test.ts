import addSubdomain from '../../src/utils/addSubdomain'

describe('utils', () => {
  describe('#addSubdomain', () => {
    it('returns url with new subdomain', () => {
      expect(addSubdomain('companyx', 'https://test.com/path/to/page')).toBe(
        'https://companyx.test.com/path/to/page'
      )

      expect(addSubdomain('companyx', 'http://lvh.me:3000/dashboard')).toBe(
        'http://companyx.lvh.me:3000/dashboard'
      )

      expect(
        addSubdomain(
          'companyx',
          'http://main.example.com/jobs/12/apply-add-experience/123123?confirmed=true'
        )
      ).toBe(
        'http://companyx.main.example.com/jobs/12/apply-add-experience/123123?confirmed=true'
      )

      expect(addSubdomain('test123', 'https://join.com')).toBe(
        'https://test123.join.com'
      )
    })
  })
})
