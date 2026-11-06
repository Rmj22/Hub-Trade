from io import BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from xml.sax.saxutils import escape

BRAND = colors.HexColor("#FF3B30")
INK = colors.HexColor("#111111")
MUTED = colors.HexColor("#666666")
LINE = colors.HexColor("#DDDDDD")

H1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=INK)
H2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=INK, spaceBefore=6)
BODY = ParagraphStyle("body", fontName="Helvetica", fontSize=10, leading=14, textColor=INK)
SMALL = ParagraphStyle("small", fontName="Helvetica", fontSize=8.5, leading=11, textColor=MUTED)
LABEL = ParagraphStyle("label", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=MUTED)
SIG = ParagraphStyle("sig", fontName="Times-BoldItalic", fontSize=18, leading=22, textColor=INK)


def _money(n) -> str:
    return f"${(n or 0):,.2f}"


def _fmt(iso) -> str:
    if not iso:
        return "—"
    try:
        return datetime.fromisoformat(iso).strftime("%B %d, %Y at %I:%M %p UTC")
    except ValueError:
        return iso


def _header(canvas, doc, company: str, estimate_no: str):
    canvas.saveState()
    w, h = letter
    canvas.setFillColor(BRAND)
    canvas.rect(0, h - 0.35 * inch, w, 0.35 * inch, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(0.75 * inch, h - 0.23 * inch, "HUB TRADE")
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(w - 0.75 * inch, h - 0.23 * inch, f"Estimate {estimate_no}")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(0.75 * inch, 0.5 * inch, f"Prepared by {company} · Generated with Hub Trade")
    canvas.drawRightString(w - 0.75 * inch, 0.5 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_estimate_pdf(est: dict, company: dict) -> bytes:
    buf = BytesIO()
    estimate_no = str(est.get("_id", ""))[-6:].upper()
    company_name = company.get("name", "")
    doc = SimpleDocTemplate(buf, pagesize=letter, leftMargin=0.75 * inch, rightMargin=0.75 * inch,
                            topMargin=0.8 * inch, bottomMargin=0.8 * inch, title=f"Estimate {estimate_no} — {company_name}")
    story = []

    status = est.get("status", "draft")
    badge = {"approved": "APPROVED & SIGNED", "sent": "AWAITING APPROVAL"}.get(status, status.upper())
    story.append(Paragraph(escape(company_name), H1))
    story.append(Paragraph(f"Estimate #{estimate_no} · {badge}", ParagraphStyle("b", parent=SMALL, textColor=BRAND, fontName="Helvetica-Bold")))
    story.append(Spacer(1, 14))

    meta = Table([
        [Paragraph("PREPARED FOR", LABEL), Paragraph("DATE", LABEL), Paragraph("DEPOSIT", LABEL)],
        [Paragraph(f"{escape(est.get('customer_name', ''))}<br/>{escape(est.get('customer_email', '') or '')}", BODY),
         Paragraph(_fmt(est.get("created_at"))[:18], BODY),
         Paragraph(f"{est.get('deposit_percent', 25):g}% — {_money(est.get('total', 0) * (est.get('deposit_percent', 25) or 0) / 100)}", BODY)],
    ], colWidths=[3.2 * inch, 2 * inch, 1.8 * inch])
    meta.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, -1), (-1, -1), 0.5, LINE), ("BOTTOMPADDING", (0, -1), (-1, -1), 10)]))
    story.append(meta)
    story.append(Spacer(1, 16))

    rows = [[Paragraph("ITEM", LABEL), Paragraph("QTY", LABEL), Paragraph("UNIT", LABEL), Paragraph("TOTAL", LABEL)]]
    for li in est.get("line_items", []):
        qty, price = li.get("qty", 1) or 0, li.get("unit_price", 0) or 0
        rows.append([Paragraph(escape(str(li.get("desc", ""))), BODY), Paragraph(f"{qty:g}", BODY), Paragraph(_money(price), BODY), Paragraph(_money(qty * price), BODY)])
    rows.append(["", "", Paragraph("<b>Total</b>", BODY), Paragraph(f"<b>{_money(est.get('total', 0))}</b>", BODY)])
    items = Table(rows, colWidths=[3.9 * inch, 0.7 * inch, 1.2 * inch, 1.2 * inch], repeatRows=1)
    items.setStyle(TableStyle([
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 1, INK), ("LINEBELOW", (0, 1), (-1, -3), 0.4, LINE),
        ("LINEABOVE", (2, -1), (-1, -1), 1, INK), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(items)

    if est.get("notes"):
        story.append(Spacer(1, 16))
        story.append(Paragraph("Scope & notes", H2))
        story.append(Paragraph(escape(est["notes"]).replace("\n", "<br/>"), BODY))

    story.append(Spacer(1, 24))
    if status == "approved":
        sig = [
            Paragraph("Customer approval", H2),
            Spacer(1, 10),
            Table([
                [Paragraph("ELECTRONIC SIGNATURE", LABEL), Paragraph("SIGNED ON", LABEL)],
                [Paragraph(escape(est.get("signature_name", "")), SIG), Paragraph(_fmt(est.get("approved_at")), BODY)],
            ], colWidths=[3.8 * inch, 3.2 * inch], style=TableStyle([("VALIGN", (0, 0), (-1, -1), "BOTTOM"), ("LINEBELOW", (0, -1), (0, -1), 0.8, INK), ("BOTTOMPADDING", (0, -1), (-1, -1), 4)])),
            Spacer(1, 8),
            Paragraph(f"Signed electronically via Hub Trade. IP {escape(str(est.get('signer_ip') or 'n/a'))}. "
                      f"Deposit {'PAID ' + _money(est.get('deposit_amount')) + ' on ' + _fmt(est.get('deposit_paid_at')) if est.get('deposit_paid') else 'not yet paid'}.", SMALL),
        ]
        story.append(KeepTogether(sig))
    else:
        story.append(KeepTogether([
            Paragraph("Customer approval", H2),
            Spacer(1, 26),
            Table([[Paragraph("SIGNATURE", LABEL), Paragraph("DATE", LABEL)]], colWidths=[3.8 * inch, 3.2 * inch],
                  style=TableStyle([("LINEABOVE", (0, 0), (-1, 0), 0.8, INK)])),
            Spacer(1, 6),
            Paragraph("This estimate has not yet been approved. Approve online using the link in your email, or sign above.", SMALL),
        ]))

    doc.build(story, onFirstPage=lambda c, d: _header(c, d, company_name, estimate_no), onLaterPages=lambda c, d: _header(c, d, company_name, estimate_no))
    return buf.getvalue()
