from flask import Flask, render_template, request, jsonify, send_file
import requests
import csv
import io
import json

app = Flask(__name__)

API_URL = "https://osu.ppy.sh/api/get_beatmaps"

MODS = ["EZ", "HD", "HR", "DT"]

def mod_string(mods):
    return "+".join(mods) if mods else "NM"


@app.route("/")
def index():
    return render_template("index.html")


# -------------------------
# LOAD MAPS (STEP 1)
# -------------------------
@app.route("/load_maps", methods=["POST"])
def load_maps():

    api_key = request.json.get("api_key")
    raw_ids = request.json.get("beatmaps", "")

    ids = [x for x in raw_ids.replace(",", " ").split() if x.isdigit()]

    maps = []

    for mid in ids:
        res = requests.get(API_URL, params={
            "k": api_key,
            "b": mid,
            "mods": 0
        })

        data = res.json()
        if not data:
            continue

        bm = data[0]

        maps.append({
            "beatmap_id": bm["beatmap_id"],
            "beatmapset_id": bm["beatmapset_id"],
            "title": bm["title"],
            "artist": bm["artist"],
            "version": bm["version"]
        })

    return jsonify(maps)


# -------------------------
# GENERATE CSV (STEP 2)
# -------------------------
@app.route("/generate", methods=["POST"])
def generate():

    api_key = request.json.get("api_key")
    maps = request.json.get("maps", [])

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "map_id", "title", "artist", "version",
        "mods", "star", "bpm", "drain",
        "combo", "cs", "ar", "od", "thumbnail"
    ])

    for m in maps:

        map_id = m["beatmap_id"]
        mods = m.get("mods", [])

        res = requests.get(API_URL, params={
            "k": api_key,
            "b": map_id,
            "mods": 0
        })

        data = res.json()
        if not data:
            continue

        bm = data[0]

        beatmap_id = bm["beatmap_id"]
        beatmapset_id = bm["beatmapset_id"]

        row = [
            f'=HYPERLINK("https://osu.ppy.sh/beatmaps/{beatmap_id}", "{beatmap_id}")',
            bm.get("title"),
            bm.get("artist"),
            bm.get("version"),
            mod_string(mods),
            f"{float(bm.get('difficultyrating', 0)):.2f}",
            bm.get("bpm"),
            bm.get("diff_drain"),
            bm.get("max_combo"),
            bm.get("diff_size"),
            bm.get("diff_approach"),
            bm.get("diff_overall"),
            f'=IMAGE("https://b.ppy.sh/thumb/{beatmapset_id}.jpg", 4, 120, 160)'
        ]

        writer.writerow(row)

    mem = io.BytesIO()
    mem.write(output.getvalue().encode("utf-8"))
    mem.seek(0)

    return send_file(
        mem,
        as_attachment=True,
        download_name="beatmaps.csv",
        mimetype="text/csv"
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
