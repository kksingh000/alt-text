// AUTO-GENERATED from packages/scorer/spec/scorer.spec.json — do not edit.
// Regenerate with: node packages/scorer/scripts/sync-spec.mjs
import type { ScorerSpec } from './types.js';

export const SPEC: ScorerSpec = {
  "version": 1,
  "genericWords": [
    "image",
    "img",
    "photo",
    "photograph",
    "picture",
    "pic",
    "graphic",
    "graphics",
    "icon",
    "logo",
    "screenshot",
    "thumbnail",
    "thumb",
    "banner",
    "placeholder",
    "avatar",
    "chart",
    "diagram",
    "figure",
    "illustration",
    "arrow",
    "button",
    "bullet",
    "spacer",
    "default",
    "stock",
    "alt"
  ],
  "genericAltPatterns": [
    "^(img|dsc|dscn|dscf|dcim|pxl|mvimg|gopr|vid)[-_ ]?\\d[\\d_ .-]*$",
    "^image[-_ ]?\\d+$",
    "^(photo|picture|pic)[-_ ]?\\d*$",
    "^\\d{6,}$",
    "^\\d{8}[-_ ]\\d{4,}$",
    "^screen[-_ ]?shot$",
    "^screen[-_ ]?shot[-_ ]?[\\d(].*$",
    "^screen[-_ ]?shot (from|at) \\d.*$",
    "^whatsapp[-_ ]image[-_ ]?\\d.*$",
    "\\.(jpe?g|png|gif|webp|avif|svg|bmp|ico|tiff?)$",
    "^untitled([-_ ]?\\d+)?$",
    "^unnamed([-_ ]?\\d+)?$",
    "^asset[-_ ]?\\d*$",
    "^[a-f0-9]{8,}$",
    "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
  ],
  "decorativeFilenamePatterns": [
    "^(spacer|divider|separator|bullet|shim|blank|transparent|pixel|clear|dot)([-_.\\d]|$)",
    "^1x1([-_.]|$)",
    "^(bg|background)([-_.\\d]|$)"
  ],
  "thresholds": {
    "tinyDimensionPx": 20,
    "spacerDimensionPx": 3,
    "minSingleWordLength": 4
  },
  "categories": {
    "MISSING": {
      "label": "Missing alt text",
      "shortLabel": "Missing",
      "description": "No alt attribute, or an empty alt on a content image.",
      "severity": "error",
      "wcag": {
        "criterion": "1.1.1",
        "name": "Non-text Content",
        "level": "A",
        "url": "https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html"
      },
      "suggestedFix": "Add an alt attribute that describes the image's content or purpose, e.g. alt=\"Golden retriever catching a red frisbee\". If the image is purely decorative, use alt=\"\" (or role=\"presentation\") so screen readers skip it.",
      "screenReaderFallback": "Image, no description available"
    },
    "GENERIC": {
      "label": "Generic or placeholder alt text",
      "shortLabel": "Generic",
      "description": "Filename-style or placeholder alt text: img_1234, DSC_0042, \"photo\".",
      "severity": "warning",
      "wcag": {
        "criterion": "1.1.1",
        "name": "Non-text Content",
        "level": "A",
        "url": "https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html"
      },
      "suggestedFix": "Replace the placeholder with a specific description of what the image shows or does. Avoid filenames, camera defaults (IMG_1234, DSC_0042), and lone words like \"image\" or \"photo\".",
      "screenReaderFallback": "Image, description may be unreliable"
    },
    "DECORATIVE_UNMARKED": {
      "label": "Decorative image not marked as decorative",
      "shortLabel": "Unmarked decorative",
      "description": "Looks decorative (spacer, divider, tiny graphic) but isn't hidden from screen readers.",
      "severity": "warning",
      "wcag": {
        "criterion": "1.1.1",
        "name": "Non-text Content",
        "level": "A",
        "url": "https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html"
      },
      "suggestedFix": "This image appears to be decorative (a spacer, divider, or tiny graphic). Mark it with alt=\"\" or role=\"presentation\" so screen readers skip it instead of announcing a filename.",
      "screenReaderFallback": null
    },
    "GOOD": {
      "label": "Alt text present and specific",
      "shortLabel": "Good",
      "description": "Descriptive alt text, or correctly marked decorative.",
      "severity": "pass",
      "wcag": {
        "criterion": "1.1.1",
        "name": "Non-text Content",
        "level": "A",
        "url": "https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html"
      },
      "suggestedFix": "No action needed.",
      "screenReaderFallback": null
    }
  }
};
