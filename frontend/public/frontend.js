const SERVER_URL = "http://localhost:4321";

// Show the button when scrolling down
window.addEventListener("scroll", () => {
    const scrollToTopBtn = document.getElementById("scroll-to-top-btn");

    if (window.scrollY > 200) { // Show button after scrolling 200px
        scrollToTopBtn.style.display = "block";
    } else {
        scrollToTopBtn.style.display = "none";
    }
});

// Scroll to the top when the button is clicked
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: "smooth" // Smooth scroll to top
    });
}


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
			  [`${datasetId}_dept`] : `${department}`
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

			//alert(JSON.stringify(query, null, 2));

            if (response.ok) {
                const result = await response.json();
                combinedData.push(...result.result);
            } else {
                const error = await response.text();
                console.warn(`Error querying dataset ${datasetId}: ${error}`);
            }
        }
        drawChart(combinedData, datasetIds);
    } catch (err) {
        document.getElementById("query-status").textContent = `Error: ${err.message}`;
    }
}

// Draw the chart using Chart.js
let chartInstance = null;

function drawChart(data, datasetIds) {
    const ctx = document.getElementById("course-chart").getContext("2d");

    // Destroy previous chart instance if it exists
    if (chartInstance) {
        chartInstance.destroy();
    }

    //const labels = data.map((entry) => entry.datasetId_id);
	const labels = data.map((entry) => {
        const datasetId = datasetIds.find((id) => `${id}_id` in entry);
        return entry[`${datasetId}_id`];
    });
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

//USER STORY : Popularity over the year
document.getElementById("enrollment-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const courseId = document.getElementById("course-id").value.trim();

    // Validate Course ID
    if (!courseId) {
        document.getElementById("query-status").textContent = "Course ID is required.";
        return;
    }

    // Clear previous messages and proceed with the chart generation
    document.getElementById("query-status").textContent = "";
    generateEnrollmentChart(courseId);
});

let enrollmentChartInstance = null;

async function generateEnrollmentChart(courseId, year) {
    clearAllMessages();

    try {
        // Fetch all dataset IDs
        const datasetIds = await fetchAllDatasetIds();
        const combinedData = [];

        // Query each dataset and combine results
        for (const datasetId of datasetIds) {
            const query = buildEnrollmentQuery(courseId, year, datasetId);
            console.log(`Query for ${datasetId}:`, JSON.stringify(query, null, 2));

            const response = await fetch(`${SERVER_URL}/query`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(query)
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`Response for ${datasetId}:`, result.result);

                // Process each dataset's results and combine
                combinedData.push(...result.result.map((entry) => ({ ...entry, datasetId })));
            } else {
                const error = await response.text();
                console.warn(`Error querying dataset ${datasetId}: ${error}`);
            }
        }

        // Handle no data found
        if (combinedData.length === 0) {
            document.getElementById("query-status").textContent = "No data found for the specified Course ID.";
            return;
        }

        // Process combined data and draw the chart
        const processedData = processCombinedEnrollmentData(combinedData, datasetIds[0]);
        drawEnrollmentChart(processedData, datasetIds[0]);
    } catch (err) {
        document.getElementById("query-status").textContent = `Error: ${err.message}`;
    }
}


function processCombinedEnrollmentData(data, datasetId) {
    const enrollmentMap = {};

    data.forEach((entry) => {
        const idField = `${datasetId}_id`;
        const yearField = `${datasetId}_year`;
        const key = `${entry[idField]}-${entry[yearField]}`;

        if (!enrollmentMap[key]) {
            enrollmentMap[key] = {
                sections_id: entry[idField],
                sections_year: entry[yearField],
                total_enrollment: 0
            };
        }

        // Sum the individual fields
        enrollmentMap[key].total_enrollment +=
            (entry.sumpass || 0) + (entry.sumfail || 0) + (entry.sumaudit || 0);
    });

    return Object.values(enrollmentMap); // Convert map back to array
}


function buildEnrollmentQuery(courseId, year, datasetId) {
    const query = {
        WHERE: {
            AND: []
        },
        OPTIONS: {
            COLUMNS: [
                `${datasetId}_id`,
                `${datasetId}_year`,
                `sumpass`,
                `sumfail`,
                `sumaudit`
            ],
            ORDER: {
                dir: "UP",
                keys: [`${datasetId}_year`]
            }
        },
        TRANSFORMATIONS: {
            GROUP: [`${datasetId}_id`, `${datasetId}_year`],
            APPLY: [
                { sumpass: { SUM: `${datasetId}_pass` } },
                { sumfail: { SUM: `${datasetId}_fail` } },
                { sumaudit: { SUM: `${datasetId}_audit` } }
            ]
        }
    };

    // Add course ID filter
    if (courseId) {
        query.WHERE.AND.push({
            IS: { [`${datasetId}_id`]: courseId }
        });
    }

    // Add year filter (optional)
    if (year) {
        query.WHERE.AND.push({
            IS: { [`${datasetId}_year`]: year }
        });
    }

    if (!year && !courseId) {
        query.WHERE = {};
    }

    return query;
}

function drawEnrollmentChart(data, datasetId) {
    const ctx = document.getElementById("enrollment-chart").getContext("2d");

    if (enrollmentChartInstance) {
        enrollmentChartInstance.destroy();
    }

    // Extract labels (years) and data (enrollment counts) dynamically
    const labels = data.map((entry) => entry.sections_year); // x-axis: years
    const enrollments = data.map((entry) => entry.total_enrollment); // y-axis: enrollment counts

    enrollmentChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Enrollment Over Time",
                data: enrollments,
                borderColor: "rgba(75, 192, 192, 1)",
                borderWidth: 2,
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Year"
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Enrollment"
                    }
                }
            }
        }
    });
}


// USER STORY: Grade trends
function buildGradeTrendsQuery(courseId, datasetId) {
    return {
        WHERE: {
            IS: { [`${datasetId}_id`]: courseId }
        },
        OPTIONS: {
            COLUMNS: [`${datasetId}_id`, `${datasetId}_year`, "avggrade"],
            ORDER: {
                dir: "UP",
                keys: [`${datasetId}_year`]
            }
        },
        TRANSFORMATIONS: {
            GROUP: [`${datasetId}_id`, `${datasetId}_year`],
            APPLY: [
                {
                    avggrade: {
                        AVG: `${datasetId}_avg`
                    }
                }
            ]
        }
    };
}

document.getElementById("grade-trends-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("Form submitted!");

    const courseId = document.getElementById("grade-course-id").value.trim();
    console.log("Course ID:", courseId);

    if (!courseId) {
        document.getElementById("query-status").textContent = "Course ID is required.";
        return;
    }

    document.getElementById("grade-query-status").textContent = "";
    generateGradeTrendsChart(courseId);
});

async function generateGradeTrendsChart(courseId) {
    clearAllMessages();

    try {
        const datasetIds = await fetchAllDatasetIds();
        if (datasetIds.length === 0) {
            document.getElementById("grade-query-status").textContent = "No datasets available.";
            return;
        }

        const combinedData = [];

        for (const datasetId of datasetIds) {
            const query = buildGradeTrendsQuery(courseId, datasetId);
            console.log(`Query for dataset ${datasetId}:`, JSON.stringify(query, null, 2));

            const response = await fetch(`${SERVER_URL}/query`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(query)
            });

            if (response.ok) {
                const result = await response.json();
                combinedData.push(...result.result.map((entry) => ({ ...entry, datasetId }))); // Add datasetId to each entry
            } else {
                const error = await response.text();
                console.warn(`Error querying dataset ${datasetId}: ${error}`);
            }
        }

        if (combinedData.length === 0) {
            document.getElementById("grade-query-status").textContent = "No data found for the specified Course ID.";
            return;
        }

        drawGradeTrendsChart(combinedData, datasetIds[0]); // Pass the first dataset ID for prefixing
    } catch (err) {
        document.getElementById("grade-query-status").textContent = `Error: ${err.message}`;
    }
}



let gradeTrendsChartInstance = null;

function drawGradeTrendsChart(data, datasetId) {
    const ctx = document.getElementById("grade-trends-chart").getContext("2d");

    // Destroy the existing chart instance if it exists
    if (gradeTrendsChartInstance) {
        gradeTrendsChartInstance.destroy();
    }

    // Extract labels (years) and data (average grades) dynamically
    const labels = [...new Set(data.map((entry) => entry[`${datasetId}_year`]))].sort(); // Unique, sorted years
    const averages = labels.map((year) => {
        // Calculate average grade for each year
        const yearData = data.filter((entry) => entry[`${datasetId}_year`] === year);
        const total = yearData.reduce((sum, entry) => sum + entry.avggrade, 0);
        return total / yearData.length;
    });

    // Create a new chart instance
    gradeTrendsChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Average Grade Over Time",
                data: averages,
                borderColor: "rgba(75, 192, 192, 1)",
                borderWidth: 2,
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Year"
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

// USER STORY: PROFESSOR GRADE OVERVIEW ///////////////////////////////////////////////////////////////////////////////////////
document.getElementById("professor-search-form").addEventListener("submit", async (e) => {
    e.preventDefault();
 
 
    const professorName = document.getElementById("professor-name").value.trim();
    if (!professorName) return alert("Please enter a professor's name.");
 
 
    try {
        // Fetch all dataset IDs
        const datasetIds = await fetchAllDatasetIds();
        const combinedData = [];
 
 
        // Query datasets for professor-specific data
        for (const datasetId of datasetIds) {
            const query = buildProfessorQuery(professorName, datasetId);
            const response = await fetch(`${SERVER_URL}/query`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(query),
            });
 
 
            if (response.ok) {
                const result = await response.json();
                combinedData.push(...result.result);
            } else {
                console.warn(`Error querying dataset ${datasetId}:`, await response.text());
            }
        }
 
 
        // Display the results
        displayProfessorResults(combinedData, datasetIds);
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
 });
 
 
 function buildProfessorQuery(professorName, datasetId) {
    return {
        WHERE: {
            IS: { [`${datasetId}_instructor`]: `*${professorName}*` },
        },
        OPTIONS: {
            COLUMNS: [`${datasetId}_title`, `${datasetId}_uuid`, "overallavg"],
            ORDER: {
                dir: "DOWN",
                keys: ["overallavg"]
            }
        },
        TRANSFORMATIONS: {
            GROUP: [`${datasetId}_title`,`${datasetId}_uuid`],
            APPLY: [
                {
                    "overallavg": {
                        AVG: `${datasetId}_avg`
                    }
                }
            ]
        }
    }
 }
 
 
 
 
 function displayProfessorResults(data, datasetIds) {
    const resultsBody = document.getElementById("results-body");
    resultsBody.innerHTML = ""
 
 
    data.forEach((row) => {
        const datasetId = datasetIds.find((id) => `${id}_title` in row);
 
 
        if (!datasetId) {
            console.warn("Unable to resolve datasetId for row:", row);
            return;
        }
 
 
        // Create a new table row for each result
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row[`${datasetId}_title`] || "N/A"}</td>
            <td>${row[`${datasetId}_uuid`] || "N/A"}</td>
            <td>${row.overallavg ? row.overallavg.toFixed(2) : "N/A"}</td>
        `;
        resultsBody.appendChild(tr);
    });
 }

 document.getElementById("clear-table-btn").addEventListener("click", () => {
    const resultsBody = document.getElementById("results-body");
    resultsBody.innerHTML = ""; // Clear the table
    console.log("Table cleared.");
});
 