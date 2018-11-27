import * as pathToRegexp from 'path-to-regexp'

import toQuerystring from './utils/toQuerystring'

export interface Options {
  subdomain?: boolean
  locale?: string
  baseUrl?: string
}

interface RouteProps {
  name: string
  page: string
  locale: string
  pattern: string
  options?: Options
}

export default class Route {
  public name: string
  public locale: string
  public pattern: string
  public page: string
  public regex: RegExp
  public keys: Array<{ name: string }>
  public keyNames: string[]
  public toPath: pathToRegexp.PathFunction
  public options: Options

  constructor({ name, locale, pattern, page, options }: RouteProps) {
    if (!name && !page) {
      throw new Error(`Missing page to render for route "${pattern}"`)
    }

    this.name = name
    this.locale = locale
    this.pattern = name === 'homepage' ? '' : pattern || `/${name}`
    this.page = page.replace(/(^|\/)homepage/, '').replace(/^\/?/, '/')
    this.regex = pathToRegexp(this.pattern, (this.keys = []))
    this.keyNames = this.keys.map(key => key.name)
    this.toPath = pathToRegexp.compile(this.pattern)
    this.options = options || {}
  }

  public match(path: string) {
    const values = this.regex.exec(path)
    if (values) {
      return this.valuesToParams(values.slice(1))
    }
    return undefined
  }

  public valuesToParams(values: string[]) {
    return values.reduce(
      (params, val, i) => ({ ...params, [this.keys[i].name]: val }),
      {} as { [key: string]: string }
    )
  }

  public getHref(params: object = {}) {
    return `${this.page}?${toQuerystring(params)}`
  }

  public getAs(params: object = {}) {
    const as = this.toPath(params) || '/'
    const keys = Object.keys(params)
    const qsKeys = keys.filter(key => this.keyNames.indexOf(key) === -1)

    const baseUrl = this.options.baseUrl

    if (!qsKeys.length) {
      return baseUrl ? `${baseUrl}${as}` : as
    }

    const qsParams = qsKeys.reduce(
      (qs, key) =>
        Object.assign(qs, {
          [key]: params[key]
        }),
      {}
    )

    const url = `${as}?${toQuerystring(qsParams)}`
    return baseUrl ? `${baseUrl}${url}` : url
  }

  public getUrls(params: object = {}) {
    const as = this.getAs(params)
    const href = this.getHref(params)
    return { as, href }
  }

  public isExternal() {
    return Boolean(this.options.baseUrl)
  }
}
