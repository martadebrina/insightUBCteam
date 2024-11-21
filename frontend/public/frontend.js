const SERVER_URL = "http://localhost:4321";

// Upload Dataset
document.getElementById("upload-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const datasetId = document.getElementById("dataset-id").value;
    const datasetKind = document.getElementById("dataset-kind").value;
    const datasetFile = document.getElementById("dataset-file").files[0];

    if (!datasetFile) {
        document.getElementById("upload-status").textContent = "Please select a file.";
        return;
    }

    const fileData = await datasetFile.arrayBuffer();
    const url = `${SERVER_URL}/dataset/${datasetId}/${datasetKind}`;

    try {
        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/x-zip-compressed"
            },
            body: fileData
        });

        const result = await response.json();

        if (response.ok) {
            document.getElementById("upload-status").textContent = `Successfully added '${datasetId}' dataset`;
        } else {
            document.getElementById("upload-status").textContent = `Error: ${result.error}`;
        }
    } catch (err) {
        document.getElementById("upload-status").textContent = `Error: ${err.message}`;
    }
});

// List Datasets
document.getElementById("list-datasets-btn").addEventListener("click", async () => {
    const url = `${SERVER_URL}/datasets`;

    try {
        const response = await fetch(url);
        const result = await response.json();

        const listElement = document.getElementById("dataset-list");
        listElement.innerHTML = "";
        result.result.forEach((dataset) => {
            const li = document.createElement("li");
            li.textContent = `ID: ${dataset.id}, Kind: ${dataset.kind}, Rows: ${dataset.numRows}`;
            listElement.appendChild(li);
        });
    } catch (err) {
        alert(`Error fetching datasets: ${err.message}`);
    }
});

// Remove Dataset
document.getElementById("remove-dataset-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const datasetId = document.getElementById("remove-dataset-id").value;
    const url = `${SERVER_URL}/dataset/${datasetId}`;

    try {
        const response = await fetch(url, {
            method: "DELETE"
        });

        const result = await response.json();

        if (response.ok) {
            document.getElementById("remove-status").textContent = `Successfully removed '${datasetId}' dataset`;
        } else {
            document.getElementById("remove-status").textContent = `Error: ${result.error}`;
        }
    } catch (err) {
        document.getElementById("remove-status").textContent = `Error: ${err.message}`;
    }
});

// Handle professor search form submission
document.getElementById("professor-search-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    clearProfessorResults();

    const professorName = document.getElementById("professor-name").value.trim();
    if (!professorName) {
        document.getElementById("professor-search-status").textContent = "Please enter a professor's name.";
        return;
    }

    const query = buildProfessorQuery(professorName);
    alert(JSON.stringify(query, null, 2));

    try {
        const response = await fetch(`${SERVER_URL}/query`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(query)
        });

        //alert(JSON.stringify(response.body, null, 2));

        if (response.ok) {
            const result = await response.json();
            alert(JSON.stringify(result.result, null, 2));
            displayProfessorResults(result.result);
        } else {
            const error = await response.text();
            document.getElementById("professor-search-status").textContent = `Error: ${error}`;
        }
    } catch (err) {
        document.getElementById("professor-search-status").textContent = `Error: ${err.message}`;
    }
});

// Build query for professor search
function buildProfessorQuery(professorName) {
    return {
        "WHERE": {
            "IS": {
                "sections_instructor": "*john*"
            }
        },
        "OPTIONS": {
            "COLUMNS": ["sections_instructor", "sections_id", "overallavg"],
            "ORDER": {
                "dir": "DOWN",
                "keys": ["overallavg"]
            }
        },
        "TRANSFORMATIONS": {
            "GROUP": ["sections_instructor", "sections_id"],
            "APPLY": [
                {
                    "overallavg": {
                        "AVG": "sections_avg"
                    }
                }
            ]
        }
    };
}

function displayProfessorResults(data) {
    console.log("Received data:", data); // Log the data for debugging

    const tableBody = document.getElementById("professor-results-body");
    if (data.length === 0) {
        document.getElementById("professor-search-status").textContent = "No results found for the given professor.";
        return;
    }

    data.forEach((entry) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${entry.sections_course || "Unknown"}</td>
            <td>${entry.sections_id || "Unknown"}</td>
            <td>${entry.overall_avg !== undefined ? entry.overall_avg.toFixed(2) : "N/A"}</td>
        `;
        tableBody.appendChild(row);
    });
}


// Clear previous results
function clearProfessorResults() {
    document.getElementById("professor-search-status").textContent = "";
    const tableBody = document.getElementById("professor-results-body");
    tableBody.innerHTML = "";
}
