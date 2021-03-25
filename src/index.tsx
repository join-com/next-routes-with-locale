import Routes from './Routes'

interface ConstructorProps<Locale extends string> {
  locale: Locale
  fallbackLocale?: Locale
}

export { default as Route, Options as RouteOptions } from './Route'

const nextRoutes = <RouteName extends string, Locale extends string = string>(
  opts: ConstructorProps<Locale>
) => new Routes<RouteName, Locale>(opts)

export default nextRoutes
