import Routes from './Routes'

interface ConstructorProps {
  locale: string
  fallbackLocale?: string
}

export { default as Route, Options as RouteOptions } from './Route'

export default (opts: ConstructorProps) => new Routes(opts)
