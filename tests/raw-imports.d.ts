// Vite (and so vitest) can import any file as a string with a `?raw` suffix.
declare module '*?raw' {
  const content: string;
  export default content;
}
