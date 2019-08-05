export const addSubdomain = (subdomain: string, url: string) =>
  url.replace(
    /^(https?:\/\/)(.*)/,
    (_, protocol, rest) => `${protocol}${subdomain}.${rest}`
  )

export default addSubdomain
