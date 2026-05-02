from __future__ import annotations

from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import Color, black
from reportlab.pdfgen import canvas


SOURCE_PDF = Path("/Users/sharanpatil/Downloads/ilovepdf_merged_removed.pdf")
OUTPUT_PDF = Path(
    "/Users/sharanpatil/Downloads/stock price prediction/output/pdf/"
    "ilovepdf_merged_removed_bordered.pdf"
)

TEMPLATE_WIDTH = 595.0
TEMPLATE_HEIGHT = 842.5

# Measured from page 3 of the source PDF.
TOP_BAR = (24.75, 813.35, 565.5 - 24.75, 817.8504 - 813.35)
BOTTOM_BAR = (25.5, 25.749, 565.5 - 25.5, 30.2494 - 25.749)
LEFT_BAR = (24.75, 30.25, 28.5 - 24.75, 813.35 - 30.25)
RIGHT_BAR = (565.5, 30.25, 569.998 - 565.5, 813.35 - 30.25)
LEFT_HIGHLIGHT = (25.5, 30.25, 26.21968 - 25.5, 813.35 - 30.25)
RIGHT_HIGHLIGHT = (568.5, 30.25, 569.21985 - 568.5, 813.35 - 30.25)

HIGHLIGHT_GRAY = Color(0.137, 0.137, 0.137)


def scale_rect(rect: tuple[float, float, float, float], sx: float, sy: float) -> tuple[float, float, float, float]:
    x, y, w, h = rect
    return x * sx, y * sy, w * sx, h * sy


def draw_rect(pdf_canvas: canvas.Canvas, rect: tuple[float, float, float, float], fill_color) -> None:
    pdf_canvas.setFillColor(fill_color)
    pdf_canvas.rect(rect[0], rect[1], rect[2], rect[3], stroke=0, fill=1)


def make_overlay(width: float, height: float):
    sx = width / TEMPLATE_WIDTH
    sy = height / TEMPLATE_HEIGHT

    buffer = BytesIO()
    pdf_canvas = canvas.Canvas(buffer, pagesize=(width, height))

    draw_rect(pdf_canvas, scale_rect(TOP_BAR, sx, sy), black)
    draw_rect(pdf_canvas, scale_rect(BOTTOM_BAR, sx, sy), black)
    draw_rect(pdf_canvas, scale_rect(LEFT_BAR, sx, sy), black)
    draw_rect(pdf_canvas, scale_rect(RIGHT_BAR, sx, sy), black)
    draw_rect(pdf_canvas, scale_rect(LEFT_HIGHLIGHT, sx, sy), HIGHLIGHT_GRAY)
    draw_rect(pdf_canvas, scale_rect(RIGHT_HIGHLIGHT, sx, sy), HIGHLIGHT_GRAY)

    pdf_canvas.showPage()
    pdf_canvas.save()
    buffer.seek(0)
    return PdfReader(buffer).pages[0]


def main() -> None:
    reader = PdfReader(str(SOURCE_PDF))
    writer = PdfWriter()

    for index, page in enumerate(reader.pages):
        if 3 <= index <= 32:
            width = float(page.mediabox.width)
            height = float(page.mediabox.height)
            page.merge_page(make_overlay(width, height))
        writer.add_page(page)

    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PDF.open("wb") as output_file:
        writer.write(output_file)

    print(f"Created PDF: {OUTPUT_PDF}")


if __name__ == "__main__":
    main()
