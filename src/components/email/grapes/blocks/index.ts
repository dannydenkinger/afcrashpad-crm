import type { Editor, Plugin } from "grapesjs"
import { ACTIONS_BLOCKS } from "./actions"
import { ADVANCED_BLOCKS } from "./advanced"
import { COMMERCE_BLOCKS } from "./commerce"
import { CONTENT_BLOCKS } from "./content"
import { FOOTER_BLOCKS, HEADER_BLOCKS } from "./headers-footers"
import { LAYOUT_BLOCKS } from "./layout"
import { MEDIA_BLOCKS } from "./media"
import { TOKEN_BLOCKS } from "./tokens"
import type { VestaBlock } from "./types"

const ALL_BLOCKS: VestaBlock[] = [
    ...LAYOUT_BLOCKS,
    ...CONTENT_BLOCKS,
    ...MEDIA_BLOCKS,
    ...ACTIONS_BLOCKS,
    ...COMMERCE_BLOCKS,
    ...HEADER_BLOCKS,
    ...FOOTER_BLOCKS,
    ...ADVANCED_BLOCKS,
    ...TOKEN_BLOCKS,
]

/**
 * GrapesJS plugin that registers all of Vesta's email blocks. Passed alongside
 * the newsletter preset — Vesta blocks complement, don't replace, the preset's
 * core primitives.
 *
 * Also hides categories of preset-provided blocks we don't want, to avoid
 * duplication between "Basic" (preset) and "Content" (ours).
 */
export const vestaBlocksPlugin: Plugin = (editor: Editor) => {
    const bm = editor.BlockManager

    for (const block of ALL_BLOCKS) {
        bm.add(block.id, {
            label: block.label,
            category: block.category,
            media: block.media,
            content: block.content,
            attributes: { class: "vesta-block-tile" },
        })
    }

    // Hide the newsletter preset's overlapping blocks so the palette isn't
    // full of duplicates. Our versions are more polished and themed.
    const PRESET_OVERLAPS = [
        "sect100",
        "sect50",
        "sect30",
        "sect37",
        "button",
        "divider",
        "text",
        "text-sect",
        "image",
        "quote",
        "link",
        "link-block",
        "grid-items",
        "list-items",
    ]
    for (const id of PRESET_OVERLAPS) {
        const b = bm.get(id)
        if (b) bm.remove(id)
    }
}
