/** Named garment colours → swatch hex. Used by the starter catalogue and the spreadsheet import. */
export const NAMED_COLORS: Record<string, string> = {
  White: "#F5F5F2", "Off White": "#EFEBE2", Ivory: "#F4EFE3", Cream: "#F1E9D8", Beige: "#D9C7A7", Sand: "#C8B48F", Khaki: "#B5A27A",
  Camel: "#B8875A", Tan: "#C19A6B", Brown: "#6B4A33", Chocolate: "#4A3124", Rust: "#A4502A", Mustard: "#C99A2E", Yellow: "#E6C84A",
  Black: "#1C1C1C", Charcoal: "#3C3C3C", Grey: "#9A9A9A", Gray: "#9A9A9A", "Light Grey": "#C9C9C6", Silver: "#BFC1C2",
  Navy: "#1F2A44", Indigo: "#2E3A6E", Blue: "#2F5D9B", "Royal Blue": "#2A4FA8", "Sky Blue": "#8DB6D9", "Powder Blue": "#B7CCE0", Teal: "#2D6E6E",
  "Light Wash": "#9BB3CC", "Mid Wash": "#5F7EA3", "Dark Wash": "#2C3A55",
  Olive: "#5B6338", Sage: "#A7B59A", Green: "#3F6E45", "Bottle Green": "#1F4733", Emerald: "#1F6B4F", Mint: "#BFDCC8",
  Maroon: "#6B1E2C", Burgundy: "#5E1A2A", Wine: "#5A1F2E", Red: "#B3262E", Coral: "#E07A62", Orange: "#D9772B",
  Pink: "#E7A9B5", Blush: "#E8B9B0", Rose: "#C97B84", Lilac: "#B9A6D3", Lavender: "#C8B9DD", Purple: "#5E3A75",
};

const byLower = new Map(Object.entries(NAMED_COLORS).map(([k, v]) => [k.toLowerCase(), v]));

export function colorHexFor(name: string): string | null {
  return byLower.get(name.trim().toLowerCase().replace(/\s+/g, " ")) ?? null;
}
