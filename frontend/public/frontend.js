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