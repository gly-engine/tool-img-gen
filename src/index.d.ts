declare module "*.lua" {
    const content: string;
    export default content;
}

declare module 'wasmoon/dist/glue.wasm' {
    const content: string;
    export default content;
}

declare module '@gamely/gly-engine' {
    const content: string;
    export default content;
}
