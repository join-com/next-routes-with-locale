/**
 * @jest-environment jsdom
 */

import NextLink from 'next/link'
import * as React from 'react'
import { createRenderer } from 'react-test-renderer/shallow'
import nextRoutes from '../src'

const renderer = createRenderer()

interface ISetupOptions {
  locale: string
  fallbackLocale?: string
  prefetch?: boolean
}

const setupRoute = (opts: ISetupOptions = { locale: 'en' }) => (
  ...args: any[]
) => {
  const routes = (nextRoutes(opts) as any).add(...args)
  const route = routes.routes[routes.routes.length - 1]
  return { routes, route }
}

describe('Routes', () => {
  const setup = (...args: any[]) => {
    const { routes, route } = setupRoute()(...args)
    const testRoute = (expected: any) => expect(route).toMatchObject(expected)
    return { routes, route, testRoute }
  }

  test('add with name and pattern', () => {
    setup('a', 'en', '/:a').testRoute({
      name: 'a',
      locale: 'en',
      pattern: '/:a',
      page: '/a'
    })
  })

  test('add with name, pattern and options', () => {
    const options = { subdomain: true }
    setup('a', 'en', '/:a', options).testRoute({
      name: 'a',
      locale: 'en',
      pattern: '/:a',
      page: '/a',
      options
    })
  })

  test('add with name, pattern and page', () => {
    setup('a', 'en', '/:a', 'b').testRoute({
      name: 'a',
      locale: 'en',
      pattern: '/:a',
      page: '/b'
    })
  })

  test('add with name, pattern,page and options', () => {
    const options = { subdomain: true }
    setup('a', 'en', '/:a', 'b', options).testRoute({
      name: 'a',
      locale: 'en',
      pattern: '/:a',
      page: '/b',
      options
    })
  })

  test('add with existing name throws', () => {
    expect(() =>
      nextRoutes({ locale: 'en' })
        .add('a', 'en', 'pattern', 'page')
        .add('a', 'en', 'pattern', 'page')
    ).toThrow()
  })

  test('page with leading slash', () => {
    setup('a', 'en', '/', '/b').testRoute({ page: '/b' })
  })

  test('homepage becomes empty url', () => {
    setup('homepage', 'en', '').testRoute({ pattern: '' })
  })

  test('match and merge params into query', () => {
    const routes = nextRoutes({ locale: 'en' })
      .add('a', 'en', 'pattern', 'page')
      .add('b', 'en', '/b/:b', 'page')
      .add('c', 'de-ch', '/de-ch/pattern', 'page')
    expect(routes.match('/b/b?b=x&c=c').query).toMatchObject({ b: 'b', c: 'c' })
    expect(routes.match('/de-ch/pattern').route!.name).toBe('c')
  })

  test('match homepage route', () => {
    const { routes, route } = setupRoute()('homepage', 'en')
    expect(routes.match('/').route).toMatchObject(route)
  })

  test('generate urls from params', () => {
    const { route } = setup('a', 'en', '/a/:b/:c+')
    const params = { b: 'b', c: [1, 2], d: 'd' }
    const expected = { as: '/a/b/1/2?d=d', href: '/a?b=b&c=1%2F2&d=d' }
    expect(route.getUrls(params)).toEqual(expected)
    expect(setup('a', 'en').route.getUrls()).toEqual({ as: '/a', href: '/a?' })
  })
})

describe('Request handler', () => {
  const setup = (url: string) => {
    const routes = nextRoutes({ locale: 'en' })
    const nextHandler = jest.fn()
    const app = { getRequestHandler: () => nextHandler, render: jest.fn() }
    return { app, routes, req: { url }, res: {} }
  }

  test('find route and call render', () => {
    const { routes, app, req, res } = setup('/en-gb/a')
    const { route, query } = routes
      .add('test', 'en-gb', '/en-gb/a', 'page')
      .match('/en-gb/a')
    routes.getRequestHandler(app)(req, res)
    expect(app.render).toBeCalledWith(req, res, route!.page, query)
  })

  test('find route and test locale is set correctly', () => {
    const routes = nextRoutes({ locale: 'en' })
    const app = { getRequestHandler: jest.fn(), render: jest.fn() }
    const req = { url: '/cs/test' } as any

    routes.add('test', 'cs', '/cs/test', 'page')
    routes.getRequestHandler(app)(req, {})
    expect(req.locale).toEqual('cs')
  })

  test('find route and call custom handler', () => {
    const { routes, app, req, res } = setup('/en-us/a')
    const { route, query } = routes
      .add('a', 'en-us', '/en-us/a', 'page')
      .match('/en-us/a')
    const customHandler = jest.fn()
    const expected = expect.objectContaining({ req, res, route, query })
    routes.getRequestHandler(app, customHandler)(req, res)
    expect(customHandler).toBeCalledWith(expected)
  })

  test('find no route and call next handler', () => {
    const { routes, app, req, res } = setup('/en/a')
    const { parsedUrl } = routes.match('/en/a')
    routes.getRequestHandler(app)(req, res)
    expect(app.getRequestHandler()).toBeCalledWith(req, res, parsedUrl)
  })
})

describe('Link', () => {
  const setup = (opts?: ISetupOptions) => (...args: any[]) => {
    const { routes, route } = setupRoute(opts)(...args)
    const { Link } = routes
    const props = { children: <a>hello</a> }
    const testLink = (addProps: any, expected: any) => {
      const actual = renderer.render(<Link {...props} {...addProps} />) as any
      expect(actual.type).toBe(NextLink)
      expect(actual.props).toEqual({ ...props, ...expected })
    }

    const testAnchor = (addProps: any, expected: any) => {
      const actual = renderer.render(<Link {...props} {...addProps} />) as any
      expect(actual.type).toBe('a')
      expect(actual.props).toMatchObject(expected)
    }
    return { routes, route, testLink, testAnchor }
  }

  test('with filtered params', () => {
    const { testLink } = setup()('a', 'en', '/a/:b')
    testLink({ href: '/', params: { b: 'b' } }, { href: '/', prefetch: false })
  })

  test('with name and params', () => {
    const { route, testLink } = setup()('a', 'en', '/a/:b')
    testLink(
      { route: 'a', params: { b: 'b' } },
      { ...route.getUrls({ b: 'b' }), prefetch: false }
    )
  })

  test('with route not found', () => {
    const { testLink } = setup()('a', 'en')
    testLink({ href: 'b' }, { href: 'b', prefetch: false })
  })

  test('with baseUrl', () => {
    const { testAnchor } = setup()('appBRoute', 'en', '/public', {
      baseUrl: 'http://lvh.me:3000'
    })
    testAnchor({ route: 'appBRoute' }, { href: 'http://lvh.me:3000/public' })
  })

  test('with fallback locale', () => {
    const { testLink } = setup({ locale: 'de', fallbackLocale: 'en' })(
      'route',
      'en',
      '/public'
    )
    testLink(
      { route: 'route', locale: 'de' },
      { as: '/public', href: '/route?', prefetch: false }
    )
  })

  test('with prefetch override', () => {
    const { testLink } = setup({
      locale: 'de',
      fallbackLocale: 'en'
    })('route', 'en', '/public')
    testLink(
      { route: 'route', locale: 'de', prefetch: true },
      { as: '/public', href: '/route?', prefetch: true }
    )
  })
})

const routerMethods = ['push', 'replace', 'prefetch']

describe(`Router ${routerMethods.join(', ')}`, () => {
  const setup = (...args: any[]) => {
    const { routes, route } = setupRoute()(...args)
    const testMethods = (otherArgs: any[], expected: any) => {
      routerMethods.forEach(method => {
        const Router = routes.getRouter({ [method]: jest.fn() })
        Router[`${method}Route`](...otherArgs)
        expect(Router[method]).toBeCalledWith(...expected)
      })
    }

    return { routes, route, testMethods }
  }

  test('with name and params', () => {
    const { route, testMethods } = setup('a', 'en', '/a/:b')
    const { as, href } = route.getUrls({ b: 'b' })
    testMethods(['a', { b: 'b' }, 'en', {}], [href, as, {}])
  })

  test('with options and without locale', () => {
    const { route, testMethods } = setup('a', 'en', '/a/:b')
    const { as, href } = route.getUrls({ b: 'b' })
    testMethods(
      ['a', { b: 'b' }, { shallow: true }],
      [href, as, { shallow: true }]
    )
  })

  test('with baseUrl', () => {
    const { routes } = setupRoute()('appBRoute', 'de-ch', '/de-ch/public/:b', {
      baseUrl: 'http://lvh.me:3000'
    })

    const spy = jest.fn()
    window.location.assign = spy

    const Router = routes.getRouter({ push: jest.fn() })
    Router.pushRoute('appBRoute', { b: 'b' }, 'de-ch')
    expect(spy).toBeCalledWith('http://lvh.me:3000/de-ch/public/b')
    expect(Router.push).not.toBeCalled()
  })
})
