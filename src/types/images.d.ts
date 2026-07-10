/**
 * Ambient types for static image imports. Metro resolves these to an asset module id (a `number`)
 * at bundle time, which RN's `Image` / expo-image accept directly. Expo's shipped types only declare
 * CSS modules, so raster assets need this to typecheck under `import logo from '...png'`.
 */
declare module '*.png' {
  const asset: number;
  export default asset;
}
declare module '*.jpg' {
  const asset: number;
  export default asset;
}
declare module '*.jpeg' {
  const asset: number;
  export default asset;
}
declare module '*.webp' {
  const asset: number;
  export default asset;
}
declare module '*.gif' {
  const asset: number;
  export default asset;
}
