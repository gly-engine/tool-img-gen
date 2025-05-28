import wasmFile from 'wasmoon/dist/glue.wasm';
import { LuaFactory, LuaMultiReturn } from 'wasmoon'
import { editor, languages } from 'monaco-editor/esm/vs/editor/editor.api'
import * as lualang from 'monaco-editor/esm/vs/basic-languages/lua/lua'
import gly from '@gamely/core-native-html5'
import gly_engine from '@gamely/gly-engine-micro' assert {type: "text"}
import defaultScript from './default.lua' assert {type: "text"}

let monacoTimeout: number;

document.addEventListener('DOMContentLoaded', async () => {
    const elInpWidth = document.querySelector('#width') as HTMLInputElement
    const elInpHeight = document.querySelector('#height') as HTMLInputElement
    const elInpStroke = document.querySelector('#stroke') as HTMLInputElement
    const elSelFormat = document.querySelector('#resolution') as HTMLInputElement
    const elBtnDownload = document.querySelector('#download') as HTMLElement
    const elChkAntiAliasing = document.querySelector('#antialiasing') as HTMLInputElement
    const elSelResolution = document.querySelector('#resolution') as HTMLInputElement 
    const elMonacoEditor = document.querySelector('#editor') as HTMLElement
    const elCanvas = document.querySelector('#gameCanvas') as HTMLCanvasElement

    languages.register({ id: 'lua' })
    languages.setMonarchTokensProvider('lua', lualang.language)
    const monacoEditor = editor.create(elMonacoEditor, {
        language: 'lua',
        theme: 'vs-dark',
        automaticLayout: true,
        fontLigatures: true,
        fontFamily: 'Cascadia Code'
    });

    monacoEditor.setValue(defaultScript)
    if (location.hash) {
        const params = new URLSearchParams(window.location.hash.slice(1))
        const code = params.get('code')?.replace(/_/g, '=')
        const res = params.get('res')?.split('x')
        if (code && code.length > 0) {
            monacoEditor.setValue(atob(code))
        }
        if (res && res.length == 2) {
            [elInpWidth.value, elInpHeight.value] = res
        }
        if (params.has('line')) {
            elInpStroke.value = parseFloat(params.get('line')!).toFixed(2)
        }
        if (params.has('aa')) {
            elChkAntiAliasing.checked = parseInt(params.get('aa')!) == 1
        }
    }

    const factory = new LuaFactory(wasmFile)
    const lua = await factory.createEngine()
    await lua.doString(gly_engine)

    lua.global.set('native_draw_start', gly.global.get('native_draw_start'))
    lua.global.set('native_draw_flush', gly.global.get('native_draw_flush'))
    lua.global.set('native_draw_clear', gly.global.get('native_draw_clear'))
    lua.global.set('native_draw_color', gly.global.get('native_draw_color'))
    lua.global.set('native_draw_font', gly.global.get('native_draw_font'))
    lua.global.set('native_draw_rect', gly.global.get('native_draw_rect'))
    lua.global.set('native_draw_line', gly.global.get('native_draw_line'))
    lua.global.set('native_draw_poly2', gly.global.get('native_draw_poly2'))
    lua.global.set('native_image_draw', gly.global.get('native_draw_image'))
    lua.global.set('native_text_print', gly.global.get('native_text_print'))
    lua.global.set('native_text_font_size', gly.global.get('native_text_font_size'))
    lua.global.set('native_text_font_name', gly.global.get('native_text_font_name'))
    lua.global.set('native_text_font_default', gly.global.get('native_text_font_default'))
    lua.global.set('native_text_font_previous', gly.global.get('native_text_font_previous'))
    lua.global.set('native_text_mensure', (x, y, text) => {
        const native_draw_text = gly.global.get('native_text_mensure')
        return LuaMultiReturn.from(native_draw_text(x, y, text))
    })

    await lua.doString(gly_engine)

    gly.global.set('native_callback_init', lua.global.get('native_callback_init'))
    gly.global.set('native_callback_loop', lua.global.get('native_callback_loop'))
    gly.global.set('native_callback_draw', lua.global.get('native_callback_draw'))
    gly.global.set('native_callback_resize', lua.global.get('native_callback_resize'))

    gly.error('canvas')
    gly.init(elCanvas)

    const apply = () => {
        const params = new URLSearchParams()
        const code = monacoEditor.getValue()
        gly.load(`return {meta={title='',version=''},callbacks={init=function()end,loop=function()end,draw=function(std)\n${code}\nend}}`)
        window.requestAnimationFrame(gly.update)
        params.set('res', `${elInpWidth.value}x${elInpHeight.value}`)
        params.set('code', btoa(code).replace(/=/g, '_'))
        params.set('line', elInpStroke.value)
        params.set('aa', `${elChkAntiAliasing.checked? 1: 0}`)
        location.hash = params.toString()
    }

    const resizeAndApply = () => {
        gly.resize(elInpWidth.value, elInpHeight.value)
        gly.stroke(parseFloat(elInpStroke.value))
        apply()
    }

    const toggleAntiAliasing = () => {
        elCanvas.style.imageRendering = elChkAntiAliasing.checked ? '': 'pixelated'
    }

    monacoEditor.onDidChangeModelContent(() => {
        clearTimeout(monacoTimeout);
        monacoTimeout = setTimeout(() => {
            apply()
        }, 100);
    });

    elSelResolution.addEventListener('change', () => {
        const [width, height] = elSelResolution.value.split('x').map(Number);
        elInpWidth.value = `${width}`;
        elInpHeight.value = `${height}`;
        elChkAntiAliasing.checked = width > 128;
        toggleAntiAliasing();
        resizeAndApply();
    })

    elBtnDownload.addEventListener('click', async (ev) => {
        ev.preventDefault();
        const ext = elSelFormat.value
        const hash7 = await (async () => {
            const hashBuffer = await crypto.subtle.digest("SHA-1", (new TextEncoder()).encode(monacoEditor.getValue()).buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex.slice(0, 7);
        })()
        const url = (() => {
            return elCanvas.toDataURL(`image/${ext}`)
        })() 
        const downloadLink = document.createElement('a')
        downloadLink.href = url
        downloadLink.target = '_blank'
        downloadLink.download = `img-${hash7}-${elInpWidth.value}x${elInpHeight.value}.${ext}`
        downloadLink.click()
        URL.revokeObjectURL(url)
    })

    elChkAntiAliasing.addEventListener('change', toggleAntiAliasing);
    elInpStroke.addEventListener('change', resizeAndApply);
    elInpWidth.addEventListener('change', resizeAndApply);
    elInpHeight.addEventListener('change', resizeAndApply);
    
    toggleAntiAliasing()
    resizeAndApply();
})
