"""Lossless PDF vector conversion/cropping, not a redraw. Requires PyMuPDF and Poppler (pdftocairo).
Usage: python scripts/extract-official-assets.py /path/to/extracted-official-zip
The approved palette overrides the old institutional ink in label text only.
"""
from pathlib import Path
import sys, json, hashlib, re, subprocess, tempfile
import fitz
source = Path(sys.argv[1]); destination = Path('public/brand'); destination.mkdir(exist_ok=True)
manual = source / 'Cura-Cafe-Identidade-referencia-4-paginas.pdf'
def export(pdf, page_number, filename, clip=None, harmonize=False):
    original = fitz.open(pdf)
    area=fitz.Rect(*clip) if clip else original[page_number].rect
    cropped=fitz.open(); page=cropped.new_page(width=area.width,height=area.height)
    page.show_pdf_page(page.rect,original,page_number,clip=area)
    with tempfile.TemporaryDirectory() as temporary:
        pdf_path=Path(temporary)/'crop.pdf'; svg_path=Path(temporary)/'crop.svg'
        cropped.save(pdf_path)
        subprocess.run(['pdftocairo','-svg',str(pdf_path),str(svg_path)],check=True)
        svg=svg_path.read_text()
    if harmonize:
        def ink(match):
            components=[float(value) for value in match.groups()]
            return '#3a2618' if all(abs(a-b)<0.12 for a,b in zip(components,[9.0196,20.7843,16.4706])) else match.group(0)
        svg=re.sub(r'rgb\(([0-9.]+)%,\s*([0-9.]+)%,\s*([0-9.]+)%\)',ink,svg)
        svg=re.sub(r'#17352a|#0f2a20','#3a2618',svg,flags=re.I)
    target=Path("public/media")/filename if filename.startswith("rotulo-") else destination/filename
    target.write_text(svg)
    return {'source':pdf.name,'page':page_number+1,'clip':clip,'sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'output':filename,'palette_override':harmonize}
records=[export(manual,0,'cura-logo.svg',(94,190,416,307)), export(manual,0,'cura-logo-negativo.svg',(266,436,386,484)), export(manual,1,'cura-simbolo.svg',(73,235,222,382))]
for name in ['SAMBA','SALSA']:
    records.append(export(source/f'Cura-Cafe-Adesivo-{name}-arte-vetorial.pdf',0,f'rotulo-{name.lower()}.svg',harmonize=True))
Path('docs/missao05/fontes-vetoriais.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
