let maps = [];

function loadMaps() {

    fetch("/load_maps", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            api_key: document.getElementById("api_key").value,
            beatmaps: document.getElementById("beatmaps").value
        })
    })
    .then(res => res.json())
    .then(data => {
        maps = data;
        renderTable();
    });
}


function renderTable() {

    let table = document.getElementById("mapTable");

    table.innerHTML = `
        <tr>
            <th>Map</th>
            <th>EZ</th>
            <th>HD</th>
            <th>HR</th>
            <th>DT</th>
        </tr>
    `;

    maps.forEach((m, i) => {

        m.mods = m.mods || [];

        table.innerHTML += `
        <tr>
            <td>${m.title}</td>

            ${["EZ","HD","HR","DT"].map(mod => `
                <td>
                    <input type="checkbox"
                        onchange="toggleMod(${i}, '${mod}')"
                        ${m.mods.includes(mod) ? "checked" : ""}>
                </td>
            `).join("")}

        </tr>
        `;
    });
}


function toggleMod(index, mod) {

    let m = maps[index];

    if (!m.mods) m.mods = [];

    if (m.mods.includes(mod)) {
        m.mods = m.mods.filter(x => x !== mod);
    } else {
        m.mods.push(mod);
    }
}


function generateCSV() {

    fetch("/generate", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            api_key: document.getElementById("api_key").value,
            maps: maps
        })
    })
    .then(res => res.blob())
    .then(blob => {

        let url = window.URL.createObjectURL(blob);
        let a = document.createElement("a");

        a.href = url;
        a.download = "beatmaps.csv";
        a.click();
    });
}
