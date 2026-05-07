let maps = [];

// Mod categories matching the tkinter design
const MOD_CATEGORIES = [
    { label: "FreeMod",         cls: "cat-fm", mods: ["FM"] },
    { label: "Diff. Reduction", cls: "cat-ez", mods: ["EZ"] },
    { label: "Visual",          cls: "cat-hd", mods: ["HD"] },
    { label: "Diff. Increase",  cls: "cat-hr", mods: ["HR"] },
    { label: "Speed",           cls: "cat-dt", mods: ["DT"] },
];

// All mod columns in order
const ALL_MODS = MOD_CATEGORIES.flatMap(c => c.mods);  // FM, EZ, HD, HR, DT

function setStatus(msg, type = "") {
    const el = document.getElementById("status");
    el.textContent = msg;
    el.className = type;
}

function rowClass(mods) {
    const noFm = mods.filter(m => m !== "FM");
    if (noFm.includes("DT") && noFm.includes("HR")) return "dthr";
    if (noFm.length > 0) return noFm[0].toLowerCase();
    if (mods.includes("FM")) return "fm";
    return "nm";
}

function loadMaps() {
    const api_key  = document.getElementById("api_key").value.trim();
    const beatmaps = document.getElementById("beatmaps").value.trim();
    if (!api_key)  return setStatus("API key is required.", "err");
    if (!beatmaps) return setStatus("No beatmap IDs entered.", "err");

    setStatus("Loading maps…", "busy");

    fetch("/load_maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key, beatmaps })
    })
    .then(r => r.json())
    .then(data => {
        maps = data.map(m => ({ ...m, mods: [] }));
        renderTable();
        document.getElementById("genBtn").disabled = maps.length === 0;
        setStatus(`Loaded ${maps.length} map${maps.length !== 1 ? "s" : ""}.`, "ok");
    })
    .catch(() => setStatus("Failed to load maps. Check your API key.", "err"));
}

function renderTable() {
    const wrap = document.getElementById("tableWrap");

    if (maps.length === 0) {
        wrap.innerHTML = '<div class="empty">No maps loaded.</div>';
        return;
    }

    // Build header rows
    let catCells = `<th class="cat-nm" rowspan="2">Map</th>`;
    MOD_CATEGORIES.forEach(cat => {
        catCells += `<th class="${cat.cls}" colspan="${cat.mods.length}">${cat.label}</th>`;
    });

    let modCells = "";
    MOD_CATEGORIES.forEach(cat => {
        cat.mods.forEach(mod => {
            modCells += `<th>${mod}</th>`;
        });
    });

    // Build data rows
    let rows = "";
    maps.forEach((m, i) => {
        const cls = rowClass(m.mods);
        const checkboxes = ALL_MODS.map(mod =>
            `<td><input type="checkbox"
                onchange="toggleMod(${i}, '${mod}')"
                ${m.mods.includes(mod) ? "checked" : ""}></td>`
        ).join("");

        rows += `
        <tr class="${cls}" id="row-${i}">
            <td class="td-title">
                <strong>${escHtml(m.title)}</strong>
                <span>${escHtml(m.artist)} — ${escHtml(m.version)}</span>
            </td>
            ${checkboxes}
        </tr>`;
    });

    wrap.innerHTML = `
    <table>
        <thead>
            <tr class="cat-row">${catCells}</tr>
            <tr class="mod-row">${modCells}</tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>`;
}

function toggleMod(index, mod) {
    const m = maps[index];
    if (m.mods.includes(mod)) {
        m.mods = m.mods.filter(x => x !== mod);
    } else {
        m.mods.push(mod);
    }
    // Update row background class
    const row = document.getElementById(`row-${index}`);
    if (row) {
        row.className = rowClass(m.mods);
    }
}

function generateXLSX() {
    const api_key = document.getElementById("api_key").value.trim();
    if (!api_key) return setStatus("API key is required.", "err");
    if (maps.length === 0) return setStatus("No maps to export.", "err");

    setStatus("Generating XLSX… this may take a moment.", "busy");
    document.getElementById("genBtn").disabled = true;

    fetch("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key, maps })
    })
    .then(r => {
        if (!r.ok) throw new Error("Server error");
        return r.blob();
    })
    .then(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href     = url;
        a.download = "beatmaps.xlsx";
        a.click();
        URL.revokeObjectURL(url);
        setStatus("XLSX downloaded!", "ok");
    })
    .catch(() => setStatus("Failed to generate XLSX.", "err"))
    .finally(() => { document.getElementById("genBtn").disabled = false; });
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
