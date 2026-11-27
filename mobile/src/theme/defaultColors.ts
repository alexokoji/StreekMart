// Theme-aware defaults for text that doesn't set its own colour. React
// Native's built-in default is black, which disappears on a dark background.
// ThemeProvider keeps these in step with the active theme; the Text and
// TextInput wrappers in App.tsx read them.
let text = "#17121F";
let placeholder = "#8E88A0";

export function setDefaultColors(nextText: string, nextPlaceholder: string) {
  text = nextText;
  placeholder = nextPlaceholder;
}
export const getDefaultTextColor = () => text;
export const getDefaultPlaceholderColor = () => placeholder;
