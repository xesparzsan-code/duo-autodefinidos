"""Dibuja el icono de Dúo: cuatro casillas (flecha, D, Ú, O) sobre fondo azul tinta."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "node_modules/@expo-google-fonts/fraunces/700Bold/Fraunces_700Bold.ttf"
TINTA, CREMA, CORAL, TURQ = "#22303C", "#F7F2E8", "#D9583B", "#1F8A8A"
SS = 4  # supermuestreo


def casillas(d, x0, y0, lado, sep, fondo_letras=CREMA):
    r = lado * 0.2
    f = ImageFont.truetype(str(FUENTE), int(lado * 0.74))
    celdas = [(0, 0, CORAL, None), (1, 0, fondo_letras, "D"), (0, 1, fondo_letras, "Ú"), (1, 1, TURQ, "O")]
    for cx, cy, color, letra in celdas:
        x, y = x0 + cx * (lado + sep), y0 + cy * (lado + sep)
        d.rounded_rectangle([x, y, x + lado, y + lado], radius=r, fill=color)
        if letra:
            tinta = "#FFFFFF" if color == TURQ else TINTA
            bx = d.textbbox((0, 0), letra, font=f, anchor="ls")
            ancho = bx[2] - bx[0]
            base = y + lado * 0.76
            d.text((x + (lado - ancho) / 2 - bx[0], base), letra, font=f, fill=tinta, anchor="ls")
        else:
            # flecha de autodefinido: hacia la derecha y luego hacia abajo
            g = lado * 0.11
            ax, ay = x + lado * 0.24, y + lado * 0.36
            bx_ = x + lado * 0.64
            d.line([(ax, ay), (bx_ + g / 2, ay)], fill="#FFFFFF", width=int(g))
            d.line([(bx_, ay - g / 2), (bx_, y + lado * 0.6)], fill="#FFFFFF", width=int(g))
            t = lado * 0.17
            py = y + lado * 0.56
            d.polygon([(bx_ - t, py), (bx_ + t, py), (bx_, py + t * 1.25)], fill="#FFFFFF")
            d.ellipse([ax - g / 2, ay - g / 2, ax + g / 2, ay + g / 2], fill="#FFFFFF")


def lienzo(tam, fondo, escala):
    img = Image.new("RGBA", (tam * SS, tam * SS), fondo)
    d = ImageDraw.Draw(img)
    total = tam * SS * escala
    sep = total * 0.07
    lado = (total - sep) / 2
    o = (tam * SS - total) / 2
    casillas(d, o, o, lado, sep)
    return img.resize((tam, tam), Image.LANCZOS)


A = RAIZ / "assets"
lienzo(1024, TINTA, 0.62).convert("RGB").save(A / "icon.png")
lienzo(1024, (0, 0, 0, 0), 0.46).save(A / "android-icon-foreground.png")
Image.new("RGB", (1024, 1024), TINTA).save(A / "android-icon-background.png")
# monocromo (iconos temáticos de Android): solo siluetas blancas
mono = lienzo(1024, (0, 0, 0, 0), 0.46)
alfa = mono.split()[3]
Image.merge("RGBA", (*Image.new("RGB", mono.size, "#FFFFFF").split(), alfa)).save(A / "android-icon-monochrome.png")
lienzo(512, (0, 0, 0, 0), 0.9).save(A / "splash-icon.png")
lienzo(64, TINTA, 0.7).convert("RGB").save(A / "favicon.png")
print("ok")
