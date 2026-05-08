let maps = [];
let parsedRomaiPool = null;

let draggedMapIndex = null;
let resizingState = null;

const SLOT_CONFIG = {
    NM: {
        label: "NoMod",
        mods: [],
        cls: "pool-nm",
        rowCls: "nm",
    },
    HD: {
        label: "Hidden",
        mods: ["HD"],
        cls: "pool-hd",
        rowCls: "hd",
    },
    HR: {
        label: "HardRock",
        mods: ["HR"],
        cls: "pool-hr",
        rowCls: "hr",
    },
    DT: {
        label: "DoubleTime",
        mods: ["DT"],
        cls: "pool-dt",
        rowCls: "dt",
    },
    FM: {
        label: "FreeMod",
        mods: ["FM"],
        cls: "pool-fm",
        rowCls: "fm",
    },
    TB: {
        label: "TieBreaker",
        mods: [],
        cls: "pool-tb",
        rowCls: "tb",
    },
    UNASSIGNED: {
        label: "Unassigned",
        mods: [],
        cls: "pool-unassigned",
        rowCls: "unassigned",
    },
};

let poolSections = [
    { type: "NM", count: 5 },
    { type: "HD", count: 3 },
    { type: "HR", count: 3 },
    { type: "DT", count: 3 },
    { type: "FM", count: 2 },
    { type: "TB", count: 1 },
];

function switchTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.remove("active");
    });

    document.querySelectorAll(".tab-page").forEach(page => {
        page.classList.remove("active");
    });

    if (tabName === "manual") {
        document.querySelectorAll(".tab-btn")[0].classList.add("active");
        document.getElementById("tab-manual").classList.add("active");
    }

    if (tabName === "romai") {
        document.querySelectorAll(".tab-btn")[1].classList.add("active");
        document.getElementById("tab-romai").classList.add("active");
    }
}

function setStatus(msg, type = "") {
    const el = document.getElementById("status");
    el.textContent = msg;
    el.className = `status ${type}`;
}

function setRomaiStatus(msg, type = "") {
    const el = document.getElementById("romaiStatus");
    el.textContent = msg;
    el.className = `status ${type}`;
}

function assignedSectionTotal() {
    return poolSections
        .filter(section => section.count > 0)
        .reduce((sum, section) => sum + section.count, 0);
}

function getRowHeight() {
    const row = document.querySelector("#tableWrap tbody tr");

    if (!row) {
        return 44;
    }

    return row.getBoundingClientRect().height || 44;
}

function getAssignments() {
    const assignments = [];
    let rowIndex = 0;

    poolSections.forEach(section => {
        for (let i = 0; i < section.count; i++) {
            if (rowIndex >= maps.length) {
                return;
            }

            const slotLabel = section.type === "TB" ? `TB${i + 1}` : `${section.type}${i + 1}`;

            assignments[rowIndex] = {
                type: section.type,
                slotLabel,
                isBlockStart: i === 0,
                blockSize: Math.min(section.count, maps.length - rowIndex),
            };

            rowIndex++;
        }
    });

    if (rowIndex < maps.length) {
        const remaining = maps.length - rowIndex;

        for (let i = 0; i < remaining; i++) {
            assignments[rowIndex + i] = {
                type: "UNASSIGNED",
                slotLabel: "",
                isBlockStart: i === 0,
                blockSize: remaining,
            };
        }
    }

    return assignments;
}

function applyAssignmentsToMaps() {
    const assignments = getAssignments();

    maps = maps.map((map, index) => {
        const assignment = assignments[index];

        if (!assignment || assignment.type === "UNASSIGNED") {
            return {
                ...map,
                mods: [],
                slot_type: "",
                slot_label: "",
            };
        }

        const config = SLOT_CONFIG[assignment.type];

        return {
            ...map,
            mods: [...config.mods],
            slot_type: assignment.type,
            slot_label: assignment.slotLabel,
        };
    });
}

function setPoolSectionsFromSlots(slots) {
    const counts = {
        NM: 0,
        HD: 0,
        HR: 0,
        DT: 0,
        FM: 0,
        TB: 0,
    };

    slots.forEach(slot => {
        const type = slotTypeFromSlot(slot.slot || slot.slot_type || "");
        counts[type] = (counts[type] || 0) + 1;
    });

    poolSections = [
        { type: "NM", count: counts.NM || 0 },
        { type: "HD", count: counts.HD || 0 },
        { type: "HR", count: counts.HR || 0 },
        { type: "DT", count: counts.DT || 0 },
        { type: "FM", count: counts.FM || 0 },
        { type: "TB", count: counts.TB || 0 },
    ];
}

function renderSectionControls() {
    const controls = document.getElementById("sectionControls");

    if (!controls) {
        return;
    }

    if (maps.length === 0) {
        controls.classList.remove("active");
        controls.innerHTML = "";
        return;
    }

    controls.classList.add("active");

    const controlsHTML = poolSections.map(section => {
        const config = SLOT_CONFIG[section.type];

        return `
        <div class="section-control">
            <div class="section-control-top">
                <span class="section-pill ${config.cls}">${section.type}</span>
                <span class="section-count">${section.count} row${section.count !== 1 ? "s" : ""}</span>
            </div>
            <div class="subtitle" style="margin-bottom:0;font-size:0.74rem;">
                Drag the ${section.type} block border to resize.
            </div>
        </div>`;
    }).join("");

    const assigned = assignedSectionTotal();
    const difference = maps.length - assigned;

    let note = "";

    if (difference > 0) {
        note = `${difference} map${difference !== 1 ? "s" : ""} currently unassigned.`;
    } else if (difference < 0) {
        note = `${Math.abs(difference)} assigned slot${Math.abs(difference) !== 1 ? "s" : ""} exceed loaded maps and will be ignored.`;
    } else {
        note = "All loaded maps are assigned to slot blocks.";
    }

    controls.innerHTML = `
        ${controlsHTML}
        <div class="section-total">
            Loaded maps: <strong>${maps.length}</strong> · Assigned rows: <strong>${assigned}</strong> · ${note}
        </div>
    `;
}

function startBlockResize(event, sectionIndex) {
    event.preventDefault();
    event.stopPropagation();

    const section = poolSections[sectionIndex];

    if (!section) {
        return;
    }

    resizingState = {
        sectionIndex,
        startY: event.clientY,
        startCount: section.count,
        rowHeight: getRowHeight(),
        lastCount: section.count,
    };

    document.body.classList.add("resizing-block");

    window.addEventListener("pointermove", handleBlockResize);
    window.addEventListener("pointerup", stopBlockResize);
}

function handleBlockResize(event) {
    if (!resizingState) {
        return;
    }

    const section = poolSections[resizingState.sectionIndex];

    if (!section) {
        return;
    }

    const deltaY = event.clientY - resizingState.startY;
    const rowDelta = Math.round(deltaY / resizingState.rowHeight);
    const nextCount = Math.max(0, resizingState.startCount + rowDelta);

    if (nextCount === resizingState.lastCount) {
        return;
    }

    section.count = nextCount;
    resizingState.lastCount = nextCount;

    applyAssignmentsToMaps();
    renderSectionControls();
    renderTable();
}

function stopBlockResize() {
    resizingState = null;

    document.body.classList.remove("resizing-block");

    window.removeEventListener("pointermove", handleBlockResize);
    window.removeEventListener("pointerup", stopBlockResize);

    renderSectionControls();
    renderTable();
}

function startMapDrag(event, index) {
    draggedMapIndex = index;

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));

    const row = event.currentTarget;
    row.classList.add("dragging");
}

function handleMapDragOver(event, index) {
    event.preventDefault();

    const row = event.currentTarget;

    document.querySelectorAll("tbody tr.drop-target").forEach(el => {
        el.classList.remove("drop-target");
    });

    row.classList.add("drop-target");
}

function handleMapDragLeave(event) {
    event.currentTarget.classList.remove("drop-target");
}

function dropMap(event, targetIndex) {
    event.preventDefault();

    const sourceIndex = draggedMapIndex;

    document.querySelectorAll("tbody tr.drop-target").forEach(el => {
        el.classList.remove("drop-target");
    });

    document.querySelectorAll("tbody tr.dragging").forEach(el => {
        el.classList.remove("dragging");
    });

    if (sourceIndex === null || sourceIndex === targetIndex) {
        draggedMapIndex = null;
        return;
    }

    const moved = maps.splice(sourceIndex, 1)[0];
    maps.splice(targetIndex, 0, moved);

    draggedMapIndex = null;

    applyAssignmentsToMaps();
    renderTable();
    renderSectionControls();
}

function endMapDrag() {
    draggedMapIndex = null;

    document.querySelectorAll("tbody tr.drop-target").forEach(el => {
        el.classList.remove("drop-target");
    });

    document.querySelectorAll("tbody tr.dragging").forEach(el => {
        el.classList.remove("dragging");
    });
}

function loadMaps() {
    const beatmaps = document.getElementById("beatmaps").value.trim();

    if (!beatmaps) {
        return setStatus("No beatmap IDs entered.", "err");
    }

    setStatus("Loading maps…", "busy");

    fetch("/load_maps", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ beatmaps }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Server error");
        }

        return response.json();
    })
    .then(data => {
        maps = data.map(m => ({
            ...m,
            mods: [],
            slot_type: "",
            slot_label: "",
        }));

        applyAssignmentsToMaps();
        renderSectionControls();
        renderTable();

        document.getElementById("genBtn").disabled = maps.length === 0;

        if (maps.length === 0) {
            setStatus("No valid maps found. Check your beatmap IDs.", "err");
        } else {
            setStatus(`Loaded ${maps.length} map${maps.length !== 1 ? "s" : ""}. Drag rows to reorder and drag block borders to resize.`, "ok");
        }
    })
    .catch(() => {
        setStatus("Failed to load maps. Check your server OAuth setup.", "err");
    });
}

function renderTable() {
    const wrap = document.getElementById("tableWrap");

    if (maps.length === 0) {
        wrap.innerHTML = '<div class="empty">No maps loaded.</div>';
        return;
    }

    applyAssignmentsToMaps();

    const assignments = getAssignments();

    let rows = "";

    maps.forEach((m, i) => {
        const assignment = assignments[i] || {
            type: "UNASSIGNED",
            slotLabel: "",
            isBlockStart: false,
            blockSize: 1,
        };

        const sectionType = assignment.type;
        const config = SLOT_CONFIG[sectionType] || SLOT_CONFIG.UNASSIGNED;

        const sectionIndex = poolSections.findIndex(section => section.type === sectionType);

        let blockCell = "";

        if (assignment.isBlockStart) {
            const resizeHandle = sectionType !== "UNASSIGNED"
                ? `<div class="resize-handle" onpointerdown="startBlockResize(event, ${sectionIndex})" title="Drag to resize ${sectionType} block"></div>`
                : "";

            blockCell = `
            <td class="pool-block" rowspan="${assignment.blockSize}">
                <div class="pool-block-inner ${config.cls}">
                    <div>
                        ${sectionType === "UNASSIGNED" ? "UNSET" : sectionType}
                        <small>${assignment.blockSize} row${assignment.blockSize !== 1 ? "s" : ""}</small>
                    </div>
                    ${resizeHandle}
                </div>
            </td>`;
        }

        rows += `
        <tr class="${config.rowCls}"
            draggable="true"
            ondragstart="startMapDrag(event, ${i})"
            ondragover="handleMapDragOver(event, ${i})"
            ondragleave="handleMapDragLeave(event)"
            ondrop="dropMap(event, ${i})"
            ondragend="endMapDrag()">
            <td class="drag-handle" title="Drag to reorder">⋮⋮</td>
            <td>${i + 1}</td>
            <td><strong>${escHtml(m.slot_label || "—")}</strong></td>
            <td class="td-title">
                <strong>${escHtml(m.title)}</strong>
                <span>${escHtml(m.artist)} — ${escHtml(m.version)}</span>
            </td>
            ${blockCell}
        </tr>`;
    });

    wrap.innerHTML = `
    <table>
        <thead class="simple-head">
            <tr>
                <th></th>
                <th>#</th>
                <th>Slot</th>
                <th>Map</th>
                <th>Pool Block</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>`;
}

function generateXLSX() {
    if (maps.length === 0) {
        return setStatus("No maps to export.", "err");
    }

    applyAssignmentsToMaps();

    setStatus("Generating XLSX… this may take a moment.", "busy");
    document.getElementById("genBtn").disabled = true;

    fetch("/generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ maps }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Server error");
        }

        return response.blob();
    })
    .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = "beatmaps.xlsx";
        a.click();

        URL.revokeObjectURL(url);

        setStatus("XLSX downloaded!", "ok");
    })
    .catch(() => {
        setStatus("Failed to generate XLSX.", "err");
    })
    .finally(() => {
        document.getElementById("genBtn").disabled = false;
    });
}

function parseRomaiPool() {
    const text = document.getElementById("romaiText").value.trim();

    if (!text) {
        return setRomaiStatus("Paste RomAI output first.", "err");
    }

    setRomaiStatus("Parsing RomAI pool…", "busy");

    fetch("/parse_romai_pool", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || "Failed to parse RomAI pool.");
            });
        }

        return response.json();
    })
    .then(data => {
        parsedRomaiPool = data;
        renderRomaiResult(data);

        document.getElementById("copyRomaiBtn").disabled = false;
        document.getElementById("resolveRomaiBtn").disabled = false;
        document.getElementById("loadResolvedBtn").disabled = true;

        setRomaiStatus(
            `Parsed ${data.slots.length} slot${data.slots.length !== 1 ? "s" : ""} from ${data.name}. Ready to resolve beatmap IDs.`,
            "ok"
        );
    })
    .catch(error => {
        parsedRomaiPool = null;
        document.getElementById("copyRomaiBtn").disabled = true;
        document.getElementById("resolveRomaiBtn").disabled = true;
        document.getElementById("loadResolvedBtn").disabled = true;
        document.getElementById("romaiResult").innerHTML = "";
        setRomaiStatus(error.message, "err");
    });
}

function resolveRomaiPool() {
    if (!parsedRomaiPool) {
        return setRomaiStatus("Parse a RomAI pool first.", "err");
    }

    setRomaiStatus("Resolving beatmap IDs through osu! API… this may take a bit.", "busy");

    document.getElementById("resolveRomaiBtn").disabled = true;
    document.getElementById("loadResolvedBtn").disabled = true;

    fetch("/resolve_romai_pool", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ pool: parsedRomaiPool }),
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || "Failed to resolve beatmap IDs.");
            });
        }

        return response.json();
    })
    .then(data => {
        parsedRomaiPool = data;
        renderRomaiResult(data);

        const summary = data.resolve_summary || {};
        const matched = summary.matched || 0;
        const review = summary.review || 0;
        const notFound = summary.not_found || 0;

        document.getElementById("resolveRomaiBtn").disabled = false;
        document.getElementById("loadResolvedBtn").disabled = matched + review > 0;

        setRomaiStatus(
            `Resolved: ${matched} matched, ${review} needs review, ${notFound} not found. You can manually enter IDs for failed maps.`,
            notFound > 0 || review > 0 ? "busy" : "ok"
        );
    })
    .catch(error => {
        document.getElementById("resolveRomaiBtn").disabled = false;
        document.getElementById("loadResolvedBtn").disabled = true;
        setRomaiStatus(error.message, "err");
    });
}

function applyManualBeatmapId(slotIndex) {
    if (!parsedRomaiPool || !parsedRomaiPool.slots || !parsedRomaiPool.slots[slotIndex]) {
        return setRomaiStatus("No slot found for manual override.", "err");
    }

    const input = document.getElementById(`manual-id-${slotIndex}`);
    const beatmapId = input ? input.value.trim() : "";

    if (!beatmapId || !/^\d+$/.test(beatmapId)) {
        return setRomaiStatus("Enter a valid numeric beatmap ID.", "err");
    }

    setRomaiStatus(`Looking up beatmap ID ${beatmapId}…`, "busy");

    fetch("/beatmap_lookup", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ beatmap_id: beatmapId }),
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || "Beatmap lookup failed.");
            });
        }

        return response.json();
    })
    .then(data => {
        const slot = parsedRomaiPool.slots[slotIndex];

        slot.beatmap_id = String(data.beatmap_id);
        slot.beatmapset_id = String(data.beatmapset_id || "");
        slot.artist = data.artist || "";
        slot.matched_title = data.title || slot.title;
        slot.matched_version = data.version || slot.version;
        slot.confidence = 100;
        slot.match_status = "manual";
        slot.candidates = [];

        updateResolveSummary();
        renderRomaiResult(parsedRomaiPool);

        document.getElementById("loadResolvedBtn").disabled = false;

        setRomaiStatus(`Manual ID applied to ${slot.slot}.`, "ok");
    })
    .catch(error => {
        setRomaiStatus(error.message, "err");
    });
}

function updateResolveSummary() {
    if (!parsedRomaiPool || !parsedRomaiPool.slots) {
        return;
    }

    const matched = parsedRomaiPool.slots.filter(slot =>
        slot.match_status === "matched" || slot.match_status === "manual"
    ).length;

    const review = parsedRomaiPool.slots.filter(slot =>
        slot.match_status === "review"
    ).length;

    const notFound = parsedRomaiPool.slots.filter(slot =>
        slot.match_status === "not_found"
    ).length;

    parsedRomaiPool.resolve_summary = {
        matched,
        review,
        not_found: notFound,
        total: parsedRomaiPool.slots.length,
    };
}

function loadResolvedRomaiPool() {
    if (!parsedRomaiPool || !parsedRomaiPool.slots) {
        return setRomaiStatus("No resolved pool available.", "err");
    }

    const resolvedSlots = parsedRomaiPool.slots.filter(slot => slot.beatmap_id);

    if (resolvedSlots.length === 0) {
        return setRomaiStatus("No beatmap IDs were resolved.", "err");
    }

    maps = resolvedSlots.map(slot => ({
        beatmap_id: String(slot.beatmap_id),
        beatmapset_id: String(slot.beatmapset_id || ""),
        title: slot.matched_title || slot.title,
        artist: slot.artist || "",
        version: slot.matched_version || slot.version,
        mods: slot.mods || [],
        slot_type: slotTypeFromSlot(slot.slot),
        slot_label: slot.slot,
    }));

    setPoolSectionsFromSlots(resolvedSlots);

    applyAssignmentsToMaps();
    renderSectionControls();
    renderTable();

    document.getElementById("genBtn").disabled = maps.length === 0;

    switchTab("manual");

    setStatus(`Loaded ${maps.length} resolved RomAI map${maps.length !== 1 ? "s" : ""} into the editor.`, "ok");
}

function slotTypeFromSlot(slot) {
    slot = String(slot || "").toUpperCase();

    if (slot.startsWith("HD")) return "HD";
    if (slot.startsWith("HR")) return "HR";
    if (slot.startsWith("DT")) return "DT";
    if (slot.startsWith("FM")) return "FM";
    if (slot.startsWith("TB")) return "TB";
    if (slot === "TB") return "TB";

    return "NM";
}

function confidenceClass(slot) {
    const confidence = Number(slot.confidence || 0);

    if (slot.match_status === "matched" || slot.match_status === "manual" || confidence >= 80) {
        return "good";
    }

    if (slot.match_status === "review" || confidence >= 50) {
        return "review";
    }

    return "bad";
}

function renderRomaiResult(pool) {
    const target = document.getElementById("romaiResult");

    const summary = pool.resolve_summary || null;

    const resolveLine = summary
        ? `<p class="subtitle" style="margin-bottom: 0;">
            Resolver summary: ${summary.matched} matched/manual · ${summary.review} needs review · ${summary.not_found} not found.
           </p>`
        : `<p class="subtitle" style="margin-bottom: 0;">
            Parsed only. Click Resolve Beatmap IDs to find osu! beatmap IDs.
           </p>`;

    const summaryHTML = `
    <div class="panel">
        <div class="summary-card">
            <div class="summary-item">
                <small>Pool Name</small>
                <strong>${escHtml(pool.name)}</strong>
            </div>
            <div class="summary-item">
                <small>Average Stars</small>
                <strong>${pool.average_stars !== null ? `${Number(pool.average_stars).toFixed(2)}★` : "N/A"}</strong>
            </div>
            <div class="summary-item">
                <small>ELO</small>
                <strong>${pool.elo !== null ? pool.elo : "N/A"}</strong>
            </div>
        </div>
        ${resolveLine}
    </div>`;

    const rows = pool.slots.map((slot, index) => {
        const type = slotTypeFromSlot(slot.slot);
        const config = SLOT_CONFIG[type] || SLOT_CONFIG.NM;

        const confidence = slot.confidence ?? null;
        const confidenceHTML = confidence === null
            ? `<span class="confidence review">—</span>`
            : `<span class="confidence ${confidenceClass(slot)}">${slot.match_status === "manual" ? "manual" : `${confidence}%`}</span>`;

        const idHTML = slot.beatmap_id
            ? `<a class="map-link" href="https://osu.ppy.sh/beatmaps/${slot.beatmap_id}" target="_blank">${slot.beatmap_id}</a>`
            : "—";

        const matchedMap = slot.beatmap_id
            ? `<strong>${escHtml(slot.matched_title || slot.title)}</strong>
               <span>${escHtml(slot.artist || "")} — ${escHtml(slot.matched_version || slot.version)}</span>`
            : `<strong>${escHtml(slot.title)}</strong>
               <span>${escHtml(slot.version)}</span>`;

        const manualInput = `
            <div class="manual-id-row">
                <input
                    type="text"
                    id="manual-id-${index}"
                    placeholder="Beatmap ID"
                    value="${slot.beatmap_id ? escHtml(slot.beatmap_id) : ""}">
                <button class="btn-secondary btn-mini" onclick="applyManualBeatmapId(${index})">Apply</button>
            </div>
        `;

        return `
        <tr class="${config.rowCls}">
            <td><strong>${escHtml(slot.slot)}</strong></td>
            <td class="td-title">
                ${matchedMap}
            </td>
            <td>${idHTML}</td>
            <td>${confidenceHTML}</td>
            <td class="manual-id-box">${manualInput}</td>
            <td>${Number(slot.stars).toFixed(2)}★</td>
            <td>${slot.bpm}</td>
            <td>${slot.ar ?? ""}</td>
            <td>${slot.od ?? ""}</td>
            <td>${slot.hp ?? ""}</td>
            <td>${slot.cs ?? ""}</td>
            <td>${escHtml(slot.length ?? "")}</td>
        </tr>`;
    }).join("");

    const table = `
    <div class="table-wrap">
        <table>
            <thead class="simple-head">
                <tr>
                    <th>Slot</th>
                    <th>Map</th>
                    <th>Beatmap ID</th>
                    <th>Confidence</th>
                    <th>Manual ID</th>
                    <th>Star</th>
                    <th>BPM</th>
                    <th>AR</th>
                    <th>OD</th>
                    <th>HP</th>
                    <th>CS</th>
                    <th>Length</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    </div>`;

    target.innerHTML = summaryHTML + table;
}

function copyParsedRomaiJSON() {
    if (!parsedRomaiPool) {
        return setRomaiStatus("No parsed pool to copy.", "err");
    }

    const jsonText = JSON.stringify(parsedRomaiPool, null, 2);

    navigator.clipboard.writeText(jsonText)
        .then(() => {
            setRomaiStatus("JSON copied to clipboard.", "ok");
        })
        .catch(() => {
            setRomaiStatus("Failed to copy JSON. Your browser may have blocked clipboard access.", "err");
        });
}

function escHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
