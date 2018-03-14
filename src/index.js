import pathToRegexp from 'path-to-regexp'
import React from 'react'
import { parse } from 'url'
import NextLink from 'next/link'
import NextRouter from 'next/router'

module.exports = opts => new Routes(opts)

class Routes {
  constructor ({
    Link = NextLink,
    Router = NextRouter,
    locale
  } = {}) {
    this.routes = []
    this.Link = this.getLink(Link)
    this.Router = this.getRouter(Router)
    this.locale = locale
  }

  add (name, locale = this.locale, pattern, page, data) {
    let options
    if (name instanceof Object) {
      options = name

      if (!options.name) {
        throw new Error(`Unnamed routes not supported`)
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

      options = {name, locale, pattern, page}

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

  setLocale (locale) {
    this.locale = locale
  }

  setRoutes (routes) {
    if (Array.isArray(routes)) {
      this.routes = []
      routes.forEach(route => {
        this.add(route.name, route.locale, route.pattern, route.page, route.data)
      })
    } else if (typeof routes === 'object') {
      this.routes = []
      this.add(routes.name, routes.locale, routes.pattern, routes.page, routes.data)
    } else {
      throw new Error('Data passed to setRoutes is neither an array nor an object')
    }
  }

  findByName (name, locale) {
    if (name) {
      return this.routes.filter(route => route.name === name && route.locale === locale)[0]
    }
  }

  match (url) {
    const parsedUrl = parse(url, true)
    const {pathname, query} = parsedUrl

    return this.routes.reduce((result, route) => {
      if (result.route) {
        return result
      }

      const params = route.match(pathname)

      if (!params) {
        return result
      }

      return {...result, route, params, query: {...query, ...params}}
    }, {query, parsedUrl})
  }

  findAndGetUrls (name, locale, params) {
    locale = locale || this.locale
    const route = this.findByName(name, locale)

    if (route) {
      return {route, urls: route.getUrls(params), byName: true}
    } else {
      throw new Error(`Route "${name}" not found`)
    }
  }

  getRequestHandler (app, customHandler) {
    const nextHandler = app.getRequestHandler()

    return (req, res) => {
      const {route, query, parsedUrl} = this.match(req.url)

      if (route) {
        req.locale = route.locale
        req.nextRoute = route.nextRoute

        if (customHandler) {
          customHandler({req, res, route, query})
        } else {
          app.render(req, res, route.page, query)
        }
      } else {
        nextHandler(req, res, parsedUrl)
      }
    }
  }

  getLink (Link) {
    const LinkRoutes = props => {
      const {href, locale, params, ...newProps} = props
      const locale2 = locale || this.locale
      const parsedUrl = parse(href)

      if (parsedUrl.hostname !== null || href[0] === '/' || href[0] === '#') {
        let propsToPass
        if (Link.propTypes) {
          const allowedKeys = Object.keys(Link.propTypes)
          propsToPass = allowedKeys.reduce((obj, key) => {
            props.hasOwnProperty(key) && (obj[key] = props[key])
            return obj
          }, {})
        } else {
          propsToPass = props
        }
        return <Link {...propsToPass} />
      }

      Object.assign(newProps, this.findAndGetUrls(href, locale2, params).urls)

      return <Link {...newProps} />
    }
    return LinkRoutes
  }

  getRouter (Router) {
    const wrap = method => (route, params, locale, options) => {
      const locale2 = typeof locale === 'string' ? locale : this.locale
      const options2 = typeof locale === 'object' ? locale : options

      const {byName, urls: {as, href}} = this.findAndGetUrls(route, locale2, params)
      return Router[method](href, as, byName ? options2 : params)
    }

    Router.pushRoute = wrap('push')
    Router.replaceRoute = wrap('replace')
    Router.prefetchRoute = wrap('prefetch')
    return Router
  }
}

class Route {
  constructor ({name, locale, pattern, page, data}) {
    if (!name && !page) {
      throw new Error(`Missing page to render for route "${pattern}"`)
    }

    this.name = name
    this.locale = locale
    this.pattern = name === 'homepage' ? '' : (pattern || `/${name}`)
    this.page = page.replace(/(^|\/)homepage/, '').replace(/^\/?/, '/')
    this.regex = pathToRegexp(this.pattern, this.keys = [])
    this.keyNames = this.keys.map(key => key.name)
    this.toPath = pathToRegexp.compile(this.pattern)
    this.data = data || {}
  }

  match (path) {
    if (path.substring(1, this.locale.length + 1) === this.locale) {
      path = path.substring(this.locale.length + 1)

      if (!path) {
        return {}
      }
    }
    const values = this.regex.exec(path)
    if (values) {
      return this.valuesToParams(values.slice(1))
    }
  }

  valuesToParams (values) {
    return values.reduce((params, val, i) => Object.assign(params, {
      [this.keys[i].name]: val
    }), {})
  }

  getHref (params = {}) {
    return `${this.page}?${toQuerystring(params)}`
  }

  getAs (params = {}) {
    const as = this.toPath(params) || '/'
    const keys = Object.keys(params)
    const qsKeys = keys.filter(key => this.keyNames.indexOf(key) === -1)

    if (!qsKeys.length) return as

    const qsParams = qsKeys.reduce((qs, key) => Object.assign(qs, {
      [key]: params[key]
    }), {})

    return `${as}?${toQuerystring(qsParams)}`
  }

  getUrls (params) {
    const as = this.getAs(params)
    const href = this.getHref(params)
    return {as, href}
  }
}

const toQuerystring = obj => Object.keys(obj).map(key => {
  let value = obj[key]
  if (Array.isArray(value)) {
    value = value.join('/')
  }
  return [
    encodeURIComponent(key),
    encodeURIComponent(value)
  ].join('=')
}).join('&')
