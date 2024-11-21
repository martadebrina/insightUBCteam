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


// Utility to clear previous messages and charts
function clearAllMessages() {
    document.getElementById("query-status").textContent = "";
    const chartCanvas = document.getElementById("course-chart");
    const ctx = chartCanvas.getContext("2d");
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
}

// Build a query for a specific dataset with an optional department filter
function buildQueryForDataset(datasetId, department) {
    const query = {
        WHERE: {},
        OPTIONS: {
            COLUMNS: [`${datasetId}_id`, "overallavg"],
            ORDER: {
                dir: "DOWN",
                keys: ["overallavg"]
            }
        },
        TRANSFORMATIONS: {
            GROUP: [`${datasetId}_id`],
            APPLY: [
                {
                    "overallavg": {
                        AVG: `${datasetId}_avg`
                    }
                }
            ]
        }
    };

    if (department) {
        query.WHERE = {
			IS: {
			  "sections_dept": `${department}`
			}
		  };
    }

    return query;
}

async function fetchAllDatasetIds() {
    const url = `${SERVER_URL}/datasets`;

    try {
        const response = await fetch(url);
        if (response.ok) {
            const result = await response.json();
            return result.result.map((dataset) => dataset.id); // Extract only dataset IDs
        } else {
            throw new Error("Failed to fetch datasets.");
        }
    } catch (err) {
        console.error("Error fetching dataset IDs:", err);
        throw err;
    }
}

// Fetch data and generate the chart
async function generateChart(department) {
    clearAllMessages();

    try {
        // Fetch all dataset IDs
        const datasetIds = await fetchAllDatasetIds();
        const combinedData = [];

		//alert(JSON.stringify(datasetIds, null, 2));

        // Query each dataset and combine results
        for (const datasetId of datasetIds) {
            const query = buildQueryForDataset(datasetId, department);
            const response = await fetch(`${SERVER_URL}/query`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(query)
            });

            if (response.ok) {
                const result = await response.json();
                combinedData.push(...result.result);
            } else {
                const error = await response.text();
                console.warn(`Error querying dataset ${datasetId}: ${error}`);
            }
        }

        // Pass combined data to the chart
        drawChart(combinedData);
    } catch (err) {
        document.getElementById("query-status").textContent = `Error: ${err.message}`;
    }
}

// Draw the chart using Chart.js
let chartInstance = null;

function drawChart(data) {
    const ctx = document.getElementById("course-chart").getContext("2d");

    // Destroy previous chart instance if it exists
    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = data.map((entry) => entry.sections_id);
    const averages = data.map((entry) => entry.overallavg);

    chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Average Grade",
                data: averages,
                backgroundColor: "rgba(54, 162, 235, 0.6)",
				fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Course ID"
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Average Grade"
                    }
                }
            }
        }
    });
}

// Handle filter form submission
document.getElementById("filter-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const department = document.getElementById("department").value.trim();
    generateChart(department);
});
