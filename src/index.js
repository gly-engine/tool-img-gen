import wasmFile from 'wasmoon/dist/glue.wasm';
import { LuaFactory, LuaMultiReturn } from 'wasmoon'
import { editor } from 'monaco-editor'
import gly from '@gamely/core-native-html5'
import gly_engine from '@gamely/gly-engine-lite/dist/main.lua'
import defaultScript from './default.lua'

let monacoTimeout;

document.addEventListener('DOMContentLoaded', async () => {
    const elInpWidth = document.querySelector('#width')
    const elInpHeight = document.querySelector('#height')
    const elSelFormat = document.querySelector('#resolution')
    const elBtnDownload = document.querySelector('#download')
    const elSelResolution = document.querySelector('#resolution')
    const elMonacoEditor = document.querySelector('#editor')
    const elCanvas = document.querySelector('#gameCanvas')

    const monacoEditor = editor.create(elMonacoEditor, {
        language: 'lua',
        theme: 'vs-dark',
        automaticLayout: true,
        fontLigatures: true,
        fontFamily: 'Cascadia Code'
    });

    monacoEditor.setValue(defaultScript)
    
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
    lua.global.set('native_draw_image', gly.global.get('native_draw_image'))
    lua.global.set('native_dict_http', gly.global.get('native_dict_http'))
    lua.global.set('native_dict_json', gly.global.get('native_dict_json'))
    lua.global.set('native_dict_poly', gly.global.get('native_dict_poly'))
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
        const code = monacoEditor.getValue()
        gly.load(`return {init=function()end,loop=function()end,draw=function(std)\n${code}\nend}`)
        gly.resize(elInpWidth.value, elInpHeight.value)
        window.requestAnimationFrame(gly.update)
    }

    monacoEditor.onDidChangeModelContent(() => {
        clearTimeout(monacoTimeout);
        monacoTimeout = setTimeout(() => {
            apply()
        }, 100);
    });

    elSelResolution.addEventListener('change', () => {
        const [width, height] = elSelResolution.value.split('x').map(Number);
        elInpWidth.value = width;
        elInpHeight.value = height;
        apply();
    })

    elBtnDownload.addEventListener('click', (ev) => {
        ev.preventDefault();
        const ext = elSelFormat.value
        const url = elCanvas.toDataURL(`image/${ext}`)
        const downloadLink = document.createElement('a')
        downloadLink.href = url
        downloadLink.target = '_blank'
        downloadLink.download = `icon.${ext}`
        downloadLink.click()
        URL.revokeObjectURL(url)
    })

    elInpWidth.addEventListener('change', apply);
    elInpHeight.addEventListener('change', apply);
    
    apply();
})
