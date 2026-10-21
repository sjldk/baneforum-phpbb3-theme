// The markup and styles of <bf-editor>, as one string for its shadow root. The HTML and the CSS
// are real files (so Biome and the editor tooling can check them) that the build reads as text.

import css from './bf-editor.css';
import html from './bf-editor.html';

export const template = `<style>${css}</style>${html}`;
