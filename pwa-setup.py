from pathlib import Path
import base64
import io
import re
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(".")
html_path = ROOT / "index.html"
html = html_path.read_text(encoding="utf-8")

# Reuse the exact brand mark already embedded in the live catalog header.
match = re.search(
    r'<img\\s+class="brandLogo"\\s+src="data:image/png;base64,([^"]+)"',
    html,
    re.IGNORECASE,
)
if not match:
    raise SystemExit("No se encontró el logo oficial .brandLogo incrustado en index.html; se cancela la generación para evitar publicar un icono incorrecto.")

logo_bytes = base64.b64decode(match.group(1))
logo = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
alpha = logo.getchannel("A")
bbox = alpha.getbbox()
if bbox:
    logo = logo.crop(bbox)

def make_icon(size: int) -> Image.Image:
    # Fondo premium borgoña/negro con acento dorado.
    bg = Image.new("RGBA", (size, size), (8, 7, 8, 255))
    draw = ImageDraw.Draw(bg)
    for y in range(size):
        t = y / max(1, size - 1)
        color = (
            int(76 * (1 - t) + 8 * t),
            int(9 * (1 - t) + 7 * t),
            int(18 * (1 - t) + 8 * t),
            255,
        )
        draw.line((0, y, size, y), fill=color)

    inset = max(3, int(size * 0.075))
    draw.rounded_rectangle(
        (inset, inset, size - inset, size - inset),
        radius=int(size * 0.14),
        outline=(247, 185, 40, 235),
        width=max(2, int(size * 0.012)),
    )

    # Mantener el logotipo dentro de la zona segura para máscaras Android.
    max_w = int(size * 0.70)
    max_h = int(size * 0.72)
    scale = min(max_w / logo.width, max_h / logo.height)
    w = max(1, int(logo.width * scale))
    h = max(1, int(logo.height * scale))
    mark = logo.resize((w, h), Image.Resampling.LANCZOS)

    # Borde claro para que las letras oscuras de la marca contrasten.
    radius = max(3, (size // 70) | 1)
    outline_alpha = mark.getchannel("A").filter(ImageFilter.MaxFilter(radius))
    outline = Image.new("RGBA", mark.size, (255, 248, 230, 0))
    outline.putalpha(outline_alpha)

    x = (size - w) // 2
    y = (size - h) // 2
    bg.alpha_composite(outline, (x, y))
    bg.alpha_composite(mark, (x, y))
    return bg.convert("RGB")

make_icon(192).save(ROOT / "icon-192.png", format="PNG", optimize=True)
make_icon(512).save(ROOT / "icon-512.png", format="PNG", optimize=True)
make_icon(180).save(ROOT / "apple-touch-icon.png", format="PNG", optimize=True)
make_icon(32).save(ROOT / "favicon-32.png", format="PNG", optimize=True)

# Insertar metadatos PWA de forma idempotente en el HTML publicado.
head_marker = "sp-pwa-head"
if head_marker not in html:
    tags = """
<!-- sp-pwa-head -->
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
"""
    if "</head>" not in html.lower():
        raise SystemExit("No se encontró </head> en index.html.")
    pos = html.lower().rfind("</head>")
    html = html[:pos] + tags + html[pos:]

# Registrar el service worker existente en la raíz del dominio, sin caché de datos.
if "sp-pwa-register" not in html:
    registration = """
<script id="sp-pwa-register">
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function (error) {
      console.warn("No se pudo registrar el servicio de instalación de Santo Pecado.", error);
    });
  });
}
</script>
"""
    pos = html.lower().rfind("</body>")
    if pos < 0:
        raise SystemExit("No se encontró </body> en index.html.")
    html = html[:pos] + registration + html[pos:]

html_path.write_text(html, encoding="utf-8")
print("PWA preparada: iconos oficiales derivados del logo del catálogo, manifest y registro SW raíz.")
