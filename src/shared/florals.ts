/**
 * Watercolour-style floral spray (dusty blue, lavender, white blossoms, sage leaves, navy berries) in the
 * spirit of the printed invitation. Inner SVG content of a 220x220 box growing from the bottom-left corner;
 * used by the web pages (partials.floralSpray) and the JPG card.
 */
export function floralPaths(): string {
  const leaf = (x: number, y: number, r: number, s: number, fill: string) =>
    `<path d="M0 0 C7 -11 20 -13 30 -8 C21 -1 9 3 0 0Z" fill="${fill}" fill-opacity=".78" transform="translate(${x} ${y}) rotate(${r}) scale(${s})"/>`;
  const bloom = (x: number, y: number, r: number, fill: string, stroke: string) => {
    const petals = [0, 72, 144, 216, 288]
      .map((a) => `<ellipse cx="0" cy="${-r * 0.55}" rx="${r * 0.42}" ry="${r * 0.6}" transform="rotate(${a})" fill="${fill}" stroke="${stroke}" stroke-width=".8"/>`)
      .join('');
    return `<g transform="translate(${x} ${y})">${petals}<circle r="${r * 0.22}" fill="#E8CF86"/><circle r="${r * 0.1}" fill="#9A7B3C"/></g>`;
  };
  const dots = (pts: [number, number][], r: number, fill: string, stroke = 'none') => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width=".6"/>`).join('');
  return `
<g stroke="#8FA58F" stroke-width="1.5" stroke-linecap="round">
<path d="M8 214 C40 170 70 120 150 70"/><path d="M8 214 C30 150 40 100 60 30"/><path d="M8 214 C70 196 130 190 206 150"/>
<path d="M62 150 C80 140 96 120 104 98"/><path d="M40 120 C30 100 26 80 30 62"/><path d="M120 186 C140 172 160 168 180 172"/></g>
${leaf(36, 170, -70, 1.3, '#A6B9A3')}${leaf(52, 140, -40, 1.1, '#8EA7BD')}${leaf(80, 128, -20, 1.2, '#A6B9A3')}${leaf(110, 98, -35, 1, '#8EA7BD')}
${leaf(44, 100, -100, 1.1, '#A6B9A3')}${leaf(48, 60, -80, 0.9, '#8EA7BD')}${leaf(90, 196, -10, 1.2, '#8EA7BD')}${leaf(140, 180, -25, 1.1, '#A6B9A3')}${leaf(176, 160, -40, 0.9, '#8EA7BD')}
${bloom(150, 70, 16, '#FBFBF8', '#A8B8CC')}${bloom(60, 32, 12, '#C9C5EC', '#9C97D0')}${bloom(104, 98, 11, '#B9CCE0', '#8AA3BF')}${bloom(206, 150, 13, '#FBFBF8', '#A8B8CC')}${bloom(30, 62, 9, '#FBFBF8', '#A8B8CC')}
${dots([[120, 60], [128, 52], [136, 46], [168, 52], [176, 60], [70, 10], [78, 18]], 2.2, '#FFFFFF', '#B9C6D6')}
${dots([[176, 172], [184, 168], [190, 176], [182, 180], [194, 166], [92, 118], [98, 126]], 3.1, '#3D5A80')}
${dots([[18, 140], [14, 128], [22, 118], [16, 108]], 2.6, '#B5B0E3')}
`;
}
