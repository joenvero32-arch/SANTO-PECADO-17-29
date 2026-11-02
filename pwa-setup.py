from pathlib import Path
import base64
import io
import re
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(".")
html_path = ROOT / "index.html"
html = html_path.read_text(encoding="utf-8")

# Crear el icono de aplicación con la nueva identidad visual aprobada.
# Diseño inspirado en el logotipo: fondo marfil, marco dorado/burdeos,
# hamburguesa con llama y nombre Santo Pecado 17-29.
logo = Image.new("RGBA", (1024, 1024), (250, 241, 222, 255))
d = ImageDraw.Draw(logo)
d.rounded_rectangle((12, 12, 1012, 1012), radius=190, fill=(124, 18, 13, 255), outline=(245, 177, 24, 255), width=24)
d.rounded_rectangle((38, 38, 986, 986), radius=164, fill=(250, 241, 222, 255), outline=(255, 204, 74, 255), width=12)
# Flame
d.polygon([(512, 60), (570, 190), (548, 238), (620, 210), (650, 286), (615, 342), (410, 342), (376, 282), (430, 210), (452, 255)], fill=(130, 20, 14, 255))
# Burger symbol
d.rounded_rectangle((350, 360, 674, 468), radius=58, fill=(255, 185, 0, 255), outline=(126, 18, 12, 255), width=20)
d.rounded_rectangle((330, 484, 694, 536), radius=25, fill=(126, 18, 12, 255))
d.rounded_rectangle((350, 552, 674, 650), radius=48, fill=(255, 185, 0, 255), outline=(126, 18, 12, 255), width=18)
# Brand typography
font_serif = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
font_sans = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
f_brand = ImageFont.truetype(font_serif, 118)
f_num = ImageFont.truetype(font_sans, 105)
f_tag = ImageFont.truetype(font_sans, 42)
for txt, y, font, color in [
    ("SANTO", 650, f_brand, (126, 18, 12, 255)),
    ("PECADO", 765, f_brand, (126, 18, 12, 255)),
    ("17-29", 865, f_num, (241, 164, 0, 255)),
    ("COMIDAS RAPIDAS", 963, f_tag, (126, 18, 12, 255)),
]:
    bb = d.textbbox((0, 0), txt, font=font)
    d.text(((1024 - (bb[2]-bb[0]))/2, y), txt, font=font, fill=color)

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
    max_w = int(size * 0.90)
    max_h = int(size * 0.90)
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

# Insertar metadatos PWA en la cabecera REAL del documento.
# El HTML contiene plantillas JavaScript con cadenas que incluyen </head>.
# find() elige el cierre del head principal; rfind() lo colocaba dentro de una plantilla.
old_head_block = """<!-- sp-pwa-head -->
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=20261102">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=20261102">
<link rel="manifest" href="/manifest.webmanifest?v=20261102">
"""
html = html.replace(old_head_block, "")
tags = old_head_block
pos = html.lower().find("</head>")
if pos < 0:
    raise SystemExit("No se encontró el cierre real de </head> en index.html.")
html = html[:pos] + tags + html[pos:]

# Registrar el service worker existente en la raíz del dominio, sin caché de datos.
if "sp-pwa-register" not in html:
    registration = """
<script id="sp-pwa-register">
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(function (error) {
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
