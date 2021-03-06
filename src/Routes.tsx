import NextLink, { LinkProps } from 'next/link'
import NextRouter, { SingletonRouter } from 'next/router'
import { ParsedUrlQuery } from 'querystring'
import * as React from 'react'
import { parse, UrlWithParsedQuery } from 'url'

import Route, {
  EventChangeOptions,
  GenerateOptions,
  Options as RouteOptions
} from './Route'

interface Params {
  [key: string]: any
}

type FnType<RouteName extends string> = (
  route: RouteName,
  params?: Params,
  localeOrOptions?: string | GenerateOptions,
  options?: GenerateOptions
) => Promise<boolean>

export interface RouterType<RouteName extends string> extends SingletonRouter {
  pushRoute: FnType<RouteName>
  replaceRoute: FnType<RouteName>
  prefetchRoute: FnType<RouteName>
}

type MakePartial<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export interface ExtendedLinkProps<RouteName>
  extends MakePartial<LinkProps, 'href'> {
  route: RouteName
  locale?: string
  to?: string
  params?: Params
}
type LinkType<RouteName> = React.FC<ExtendedLinkProps<RouteName>>

interface ConstructorProps<Locale extends string> {
  locale: Locale
  fallbackLocale?: Locale
}

interface MatchedRoute<RouteName extends string, Locale extends string> {
  query?: ParsedUrlQuery
  route?: Route<RouteName, Locale>
  params?: Params
  parsedUrl: UrlWithParsedQuery
}

export default class Routes<RouteName extends string, Locale extends string> {
  public routes: Array<Route<RouteName, Locale>>
  public Link: LinkType<RouteName>
  public Router: RouterType<RouteName>
  public locale: Locale
  public fallbackLocale?: string

  constructor({ locale, fallbackLocale }: ConstructorProps<Locale>) {
    this.routes = []
    this.Link = this.getLink(NextLink)
    this.Router = this.getRouter(NextRouter as RouterType<RouteName>)
    this.locale = locale
    this.fallbackLocale = fallbackLocale
  }

  public add(
    name: RouteName,
    locale: Locale = this.locale,
    pattern: string,
    page: string | RouteOptions,
    options?: RouteOptions
  ) {
    if (typeof page === 'object') {
      options = page
      page = name
    }
    const routeParams = { name, locale, pattern, page: page || name, options }

    if (this.findByName(name, locale)) {
      throw new Error(`Route "${name}" already exists`)
    }
    this.routes.push(new Route(routeParams))
    return this
  }

  public setLocale(locale: Locale) {
    this.locale = locale
  }

  public findByName(name: string, locale?: string) {
    locale = locale || this.locale
    return this.routes.filter(
      item => item.name === name && item.locale === locale
    )[0]
  }

  public findByNameWithFallback(name: string, locale: string) {
    const route = this.findByName(name, locale)
    if (route) {
      return route
    }

    if (!this.fallbackLocale) {
      return
    }

    if (locale === this.fallbackLocale) {
      return
    }

    return this.findByName(name, this.fallbackLocale)
  }

  public match(url: string): MatchedRoute<RouteName, Locale> {
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
      { parsedUrl } as MatchedRoute<RouteName, Locale>
    )
  }

  public findAndGetUrls(
    nameOrUrl: string | RouteName,
    locale: string,
    params?: Params,
    options?: EventChangeOptions | GenerateOptions
  ) {
    locale = locale || this.locale
    const foundRoute = this.findByNameWithFallback(nameOrUrl, locale)
    if (foundRoute) {
      return {
        route: foundRoute,
        urls: foundRoute.getUrls(params, options),
        byName: true
      }
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
    const LinkRoutes: React.FC<ExtendedLinkProps<RouteName>> = props => {
      const { route, params, locale, to, ...newProps } = props
      const nameOrUrl = route || to

      const locale2 = locale || this.locale

      if (nameOrUrl) {
        const foundRouteData = this.findAndGetUrls(nameOrUrl, locale2, params)
        const {
          route: foundRoute,
          urls: { as }
        } = foundRouteData
        if (foundRoute && foundRoute.isExternal()) {
          const { children, ...propsWithoutChildren } = newProps

          return React.cloneElement(props.children as React.ReactElement, {
            href: as,
            ...propsWithoutChildren
          })
        }
        Object.assign(newProps, foundRouteData.urls)
      }

      return <Link prefetch={false} {...newProps} />
    }

    return LinkRoutes
  }

  public getRouter(Router: RouterType<RouteName>) {
    const wrap = (method: string) => (
      routeName: RouteName,
      params: any,
      locale: string | GenerateOptions,
      options: GenerateOptions
    ) => {
      const locale2 = typeof locale === 'string' ? locale : this.locale
      const options2 = typeof locale === 'object' ? locale : options

      const {
        byName,
        route,
        urls: { as, href }
      } = this.findAndGetUrls(routeName, locale2, params, options2)
      if (route && route.isExternal()) {
        if (method === 'prefetch') {
          throw new Error('External route cannot be prefetched')
        }
        return window.location.assign(as)
      }
      return Router[method](href, as, byName ? options2 : params)
    }

    Router.pushRoute = wrap('push')
    Router.replaceRoute = wrap('replace')
    Router.prefetchRoute = wrap('prefetch')

    return Router
  }
}
