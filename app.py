from flask import Flask, render_template, request, jsonify, send_file
import requests
import io
import json
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment
from openpyxl.utils import get_column_letter

app = Flask(__name__)

API_URL = "https://osu.ppy.sh/api/get_beatmaps"

MODS = {"EZ": 2, "HD": 8, "HR": 16, "DT": 64}

MOD_ROW_COLORS = {
    "DT+HR": "DDA0DD",
    "DT":    "B0E0E6",
    "HR":    "FFB6C1",
    "EZ":    "C1F0C1",
    "HD":    "FFFACD",
    "FM":    "FFE4B5",
    "NM":    "F0F0F0",
}

def ar_to_ms(ar):
    return 1800 - 120 * ar if ar <= 5 else 1200 - 150 * (ar - 5)

def ms_to_ar(ms):
    return (1800 - ms) / 120 if ms >= 1200 else 5 + (1200 - ms) / 150

def apply_mods(bm, active_mods):
    cs  = float(bm.get("diff_size",     0) or 0)
    ar  = float(bm.get("diff_approach", 0) or 0)
    od  = float(bm.get("diff_overall",  0) or 0)
    hp  = float(bm.get("diff_drain",    0) or 0)
    bpm = float(bm.get("bpm",           0) or 0)

    if "EZ" in active_mods:
        cs *= 0.5; ar *= 0.5; od *= 0.5; hp *= 0.5

    if "HR" in active_mods:
        cs = min(cs * 1.3, 10)
        ar = min(ar * 1.4, 10)
        od = min(od * 1.4, 10)
        hp = min(hp * 1.4, 10)

    if "DT" in active_mods:
        bpm *= 1.5
        ar = ms_to_ar(ar_to_ms(ar) / 1.5)
        od = (79.5 - (79.5 - 6 * od) / 1.5) / 6
        ar = min(max(ar, 0), 11)
        od = min(max(od, 0), 11)

    return {
        "cs":  round(cs,  2),
        "ar":  round(ar,  2),
        "od":  round(od,  2),
        "hp":  round(hp,  2),
        "bpm": round(bpm, 1),
    }

def row_fill_color(active_mods):
    no_fm = [m for m in active_mods if m != "FM"]
    if "DT" in no_fm and "HR" in no_fm:
        key = "DT+HR"
    elif no_fm:
        key = no_fm[0]
    elif "FM" in active_mods:
        key = "FM"
    else:
        key = "NM"
    return MOD_ROW_COLORS.get(key, "FFFFFF")

def star_fill_color(sr):
    try:
        sr = float(sr)
    except (ValueError, TypeError):
        return "FFFFFF"
    if sr < 2:  return "BBBBBB"
    if sr < 3:  return "88CC66"
    if sr < 4:  return "DDDD44"
    if sr < 5:  return "FF9922"
    if sr < 6:  return "FF6644"
    if sr < 7:  return "EE44AA"
    return              "AA22CC"

def mod_string(mods):
    return "+".join(mods) if mods else "NM"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/load_maps", methods=["POST"])
def load_maps():
    api_key = request.json.get("api_key")
    raw_ids = request.json.get("beatmaps", "")
    ids = [x for x in raw_ids.replace(",", " ").split() if x.isdigit()]

    maps = []
    for mid in ids:
        res = requests.get(API_URL, params={"k": api_key, "b": mid, "mods": 0})
        data = res.json()
        if not data:
            continue
        bm = data[0]
        maps.append({
            "beatmap_id":    bm["beatmap_id"],
            "beatmapset_id": bm["beatmapset_id"],
            "title":         bm["title"],
            "artist":        bm["artist"],
            "version":       bm["version"],
        })
    return jsonify(maps)


@app.route("/generate", methods=["POST"])
def generate():
    api_key = request.json.get("api_key")
    maps    = request.json.get("maps", [])

    wb = Workbook()
    ws = wb.active
    ws.title = "Beatmaps"

    headers = [
        "Map ID", "Title", "Artist", "Version",
        "Mods", "★ Star", "BPM", "HP Drain",
        "Max Combo", "CS", "AR", "OD", "Thumbnail"
    ]
    ws.append(headers)

    hdr_fill  = PatternFill("solid", fgColor="1E1E2E")
    hdr_font  = Font(bold=True, color="FFFFFF", name="Arial", size=10)
    hdr_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill      = hdr_fill
        cell.font      = hdr_font
        cell.alignment = hdr_align
    ws.row_dimensions[1].height = 24

    col_widths = [14, 30, 22, 22, 14, 8, 10, 10, 12, 8, 8, 8, 22]
    for i, w in enumerate(col_widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

    for m in maps:
        map_id      = m["beatmap_id"]
        active_mods = m.get("mods", [])
        bitmask     = sum(MODS.get(mod, 0) for mod in active_mods if mod != "FM")

        res_nm = requests.get(API_URL, params={"k": api_key, "b": map_id, "mods": 0})
        data_nm = res_nm.json()
        if not data_nm:
            continue
        bm = data_nm[0]

        star_val = bm.get("difficultyrating", "")
        if bitmask:
            res_mod = requests.get(API_URL, params={"k": api_key, "b": map_id, "mods": bitmask})
            data_mod = res_mod.json()
            if data_mod:
                star_val = data_mod[0].get("difficultyrating", star_val)

        star_str      = f"{float(star_val):.2f}" if star_val else ""
        adj           = apply_mods(bm, active_mods)
        beatmap_id    = bm.get("beatmap_id")
        beatmapset_id = bm.get("beatmapset_id")
        map_link      = f'=HYPERLINK("https://osu.ppy.sh/beatmaps/{beatmap_id}","{beatmap_id}")'
        thumbnail     = f'=IMAGE("https://b.ppy.sh/thumb/{beatmapset_id}.jpg",4,120,160)'

        row_data = [
            map_link,
            bm.get("title",    ""),
            bm.get("artist",   ""),
            bm.get("version",  ""),
            mod_string(active_mods),
            star_str,
            adj["bpm"],
            adj["hp"],
            bm.get("max_combo", ""),
            adj["cs"],
            adj["ar"],
            adj["od"],
            thumbnail,
        ]
        ws.append(row_data)

        xlsx_row = ws.max_row
        rf       = PatternFill("solid", fgColor=row_fill_color(active_mods))
        center   = Alignment(horizontal="center", vertical="center")
        for col_idx in range(1, len(headers) + 1):
            cell           = ws.cell(row=xlsx_row, column=col_idx)
            cell.fill      = rf
            cell.alignment = center
            cell.font      = Font(name="Arial", size=10)

        if star_str:
            star_cell      = ws.cell(row=xlsx_row, column=6)
            star_cell.fill = PatternFill("solid", fgColor=star_fill_color(star_str))
            star_cell.font = Font(bold=True, name="Arial", size=10)

        ws.row_dimensions[xlsx_row].height = 20

    mem = io.BytesIO()
    wb.save(mem)
    mem.seek(0)

    return send_file(
        mem,
        as_attachment=True,
        download_name="beatmaps.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
