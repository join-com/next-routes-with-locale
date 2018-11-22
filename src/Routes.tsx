import NextLink, { LinkProps } from 'next/link'
import NextRouter, { SingletonRouter } from 'next/router'
import * as React from 'react'
import { parse } from 'url'

import Route from './Route'

interface NextRouteOptions {
  shallow: boolean
}

type FnType = (
  route: string,
  params?: any,
  locale?: string | NextRouteOptions,
  options?: NextRouteOptions
) => void

type RouterType = typeof NextRouter & {
  pushRoute: FnType
  replaceRoute: FnType
  prefetchRoute: FnType
}

interface ExtendedLinkProps extends LinkProps {
  route: string
  locale?: string
  to?: string
  params?: any
}
type LinkType = React.SFC<ExtendedLinkProps>

interface ConstructorProps {
  Link?: any
  Router?: any
  locale: string
}

interface Option {
  name: string
  page: string
  locale: string
  pattern: string
  data?: any
}

export default class Routes {
  public routes: Route[]
  public Link: LinkType
  public Router: RouterType
  public locale: string

  constructor({ locale }: ConstructorProps) {
    this.routes = []
    this.Link = this.getLink(NextLink)
    this.Router = this.getRouter(NextRouter)
    this.locale = locale
  }

  public add(
    name: string | Option,
    locale: string = this.locale,
    pattern: string,
    page: string,
    data?: any
  ) {
    let options: Option
    if (typeof name === 'object') {
      options = name

      if (!options.name) {
        throw new Error('Unnamed routes not supported')
      }

      name = options.name

      if (!options.page) {
        options.page = options.name
      }

      locale = options.locale || this.locale
    } else {
      if (typeof page === 'object') {
        data = page
        page = name
      } else {
        page = page || name
      }

      options = { name, locale, pattern, page }

      if (data) {
        options.data = data
      }
    }

    if (this.findByName(name, locale)) {
      throw new Error(`Route "${name}" already exists`)
    }
    this.routes.push(new Route(options))
    return this
  }

  public setLocale(locale: string) {
    this.locale = locale
  }

  public findByName(name: string, locale?: string) {
    locale = locale || this.locale
    if (name) {
      return this.routes.filter(
        route => route.name === name && route.locale === locale
      )[0]
    }
    return undefined
  }

  public match(url: string) {
    const parsedUrl = parse(url, true)
    const { pathname, query } = parsedUrl

    return this.routes.reduce(
      (result, route) => {
        if (result.route) {
          return result
        }
        const params = route.match(pathname!)
        if (!params) {
          return result
        }
        return { ...result, route, params, query: { ...query, ...params } }
      },
      { query, parsedUrl } as {
        query: any
        route?: Route
        params?: any
        parsedUrl: any
      }
    )
  }

  public findAndGetUrls(nameOrUrl: string, locale: string, params: any) {
    locale = locale || this.locale
    const foundRoute = this.findByName(nameOrUrl, locale)

    if (foundRoute) {
      return { foundRoute, urls: foundRoute.getUrls(params), byName: true }
    } else {
      const { route, query } = this.match(nameOrUrl)
      const href = route ? route.getHref(query) : nameOrUrl
      const urls = { href, as: nameOrUrl }
      return { route, urls }
    }
  }

  public getRequestHandler(app: any, customHandler?: any) {
    const nextHandler = app.getRequestHandler()

    return (req: any, res: any) => {
      const { route, query, parsedUrl } = this.match(req.url)

      if (route) {
        req.locale = route.locale
        // req.nextRoute = route.nextRoute

        if (customHandler) {
          customHandler({ req, res, route, query })
        } else {
          app.render(req, res, route.page, query)
        }
      } else {
        nextHandler(req, res, parsedUrl)
      }
    }
  }

  public getLink(Link: typeof NextLink) {
    const LinkRoutes: React.SFC<ExtendedLinkProps> = props => {
      const { route, params, locale, to, ...newProps } = props
      const nameOrUrl = route || to

      const locale2 = locale || this.locale

      if (nameOrUrl) {
        Object.assign(
          newProps,
          this.findAndGetUrls(nameOrUrl, locale2, params).urls
        )
      }

      return <Link {...newProps} />
    }

    return LinkRoutes
  }

  public getRouter(Router: SingletonRouter): RouterType {
    const wrap = (method: string) => (
      route: string,
      params: any,
      locale: string | any,
      options: any
    ) => {
      const locale2 = typeof locale === 'string' ? locale : this.locale
      const options2 = typeof locale === 'object' ? locale : options

      const {
        byName,
        urls: { as, href }
      } = this.findAndGetUrls(route, locale2, params)
      return Router[method](href, as, byName ? options2 : params)
    }

    return {
      ...Router,
      pushRoute: wrap('push'),
      replaceRoute: wrap('replace'),
      prefetchRoute: wrap('prefetch')
    }
  }
}