// Citation:
// 	To get the syntax for implementation we use CHATGPT.
// 	OpenAI. (2024). Assistance with JavaScript and Query Implementation for Dataset Analysis. Retrieved from ChatGPT by OpenAI.

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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// UPLOAD DATASET
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


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// LIST DATASET
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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// REMOVE DATASET
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


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// USER STORY 1: POPULARITY OF COURSES OVER THE YEAR
document.getElementById("enrollment-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const courseId = document.getElementById("course-id").value.trim();

    if (!courseId) {
        document.getElementById("query-status").textContent = "Course ID is required.";
        return;
    }

    document.getElementById("query-status").textContent = "";
    generateEnrollmentChart(courseId);
});

let enrollmentChartInstance = null;

async function generateEnrollmentChart(courseId, year) {
    clearAllMessages();

    try {
        const datasetIds = await fetchAllDatasetIds();
        const combinedData = [];

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

                combinedData.push(...result.result.map((entry) => ({ ...entry, datasetId })));
            } else {
                const error = await response.text();
                console.warn(`Error querying dataset ${datasetId}: ${error}`);
            }
        }

        if (combinedData.length === 0) {
            document.getElementById("query-status").textContent = "No data found for the specified Course ID.";
            return;
        }

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

        enrollmentMap[key].total_enrollment +=
            (entry.sumpass || 0) + (entry.sumfail || 0) + (entry.sumaudit || 0);
    });

    return Object.values(enrollmentMap);
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


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// USER STORY 2: DISPLAY AVERAGE GRADES BY COURSE

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
        const datasetIds = await fetchAllDatasetIds();
        const combinedData = [];

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

let chartInstance = null;

function drawChart(data, datasetIds) {
    const ctx = document.getElementById("course-chart").getContext("2d");

    if (chartInstance) {
        chartInstance.destroy();
    }

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

document.getElementById("filter-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const department = document.getElementById("department").value.trim();
    generateChart(department);
});


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// USER STORY 3: TRACK GRADE TRENDS OVER YEAR
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

    if (gradeTrendsChartInstance) {
        gradeTrendsChartInstance.destroy();
    }

    const labels = [...new Set(data.map((entry) => entry[`${datasetId}_year`]))].sort(); // Unique, sorted years
    const averages = labels.map((year) => {
        const yearData = data.filter((entry) => entry[`${datasetId}_year`] === year);
        const total = yearData.reduce((sum, entry) => sum + entry.avggrade, 0);
        return total / yearData.length;
    });

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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// USER STORY 4: PROFESSOR GRADE OVERVIEW
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


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// USER STORY 5: LOW AVERAGE COURSE
document.getElementById("course-filter-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const department = document.getElementById("department-filter").value.trim();
    const gradeThreshold = parseFloat(document.getElementById("grade-threshold").value);

    if (!department || isNaN(gradeThreshold)) {
        alert("Please enter valid values for both department and grade threshold.");
        return;
    }

    try {
        // Fetch all dataset IDs
        const datasetIds = await fetchAllDatasetIds();
        const combinedData = [];

        // Query each dataset
        for (const datasetId of datasetIds) {
            const query = buildCourseFilterQuery(department, gradeThreshold, datasetId);
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

        displayFilterResults(combinedData, datasetIds);
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
});

function buildCourseFilterQuery(department, gradeThreshold, datasetId) {
    return {
		WHERE: {
		  AND: [
			{
			  IS: {
				[`${datasetId}_dept`]: `${department}`
			  }
			},
			{
			  LT: {
				[`${datasetId}_avg`]: gradeThreshold
			  }
			}
		  ]
		},
		OPTIONS: {
		  COLUMNS: [
			`${datasetId}_title`,
			`${datasetId}_instructor`,
			`${datasetId}_avg`
		  ],
		  ORDER: {
			dir: "UP",
			keys: [`${datasetId}_avg`]
		}
		}
	  };
}

function displayFilterResults(data, datasetIds) {
    const resultsBody = document.getElementById("filter-results-body");
    resultsBody.innerHTML = "";

    if (data.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="3">No courses found matching the criteria.</td>`;
        resultsBody.appendChild(tr);
        return;
    }

    data.forEach((row) => {
        const datasetId = datasetIds.find((id) => `${id}_title` in row);
        if (!datasetId) return;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${row[`${datasetId}_title`] || "N/A"}</td>
            <td>${row[`${datasetId}_instructor`] || "N/A"}</td>
            <td>${row[`${datasetId}_avg`] ? row[`${datasetId}_avg`].toFixed(2) : "N/A"}</td>
        `;
        resultsBody.appendChild(tr);
    });
}

document.getElementById("clear-filter-table-btn").addEventListener("click", () => {
    const resultsBody = document.getElementById("filter-results-body");
    resultsBody.innerHTML = ""; // Clear the table content
    console.log("Filter results table cleared.");
});


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// USER STORY 6: VIEW COURSE PASS/FAIL TRENDS BY YEAR
document.getElementById("pass-fail-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const courseName = document.getElementById("course-name").value.trim();

    if (!courseName) {
        document.getElementById("query-status").textContent = "Course name is required.";
        return;
    }

    document.getElementById("query-status").textContent = "";
    generatePassFailChart(courseName);
});

async function generatePassFailChart(courseName) {
    clearAllMessages();

    try {
        const datasetIds = await fetchAllDatasetIds();
        const combinedData = [];

        for (const datasetId of datasetIds) {
            const query = buildPassFailQuery(courseName, datasetId);
            const response = await fetch(`${SERVER_URL}/query`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(query)
            });

            if (response.ok) {
                const result = await response.json();
                combinedData.push(...result.result.map((entry) => ({ ...entry, datasetId })));
            } else {
                const error = await response.text();
                console.warn(`Error querying dataset ${datasetId}: ${error}`);
            }
        }

        if (combinedData.length === 0) {
            document.getElementById("query-status").textContent = "No data found for the specified course.";
            return;
        }

        drawPassFailChart(combinedData, datasetIds[0]);
    } catch (err) {
        document.getElementById("query-status").textContent = `Error: ${err.message}`;
    }
}

function buildPassFailQuery(courseName, datasetId) {
    return {
        WHERE: {
            IS: { [`${datasetId}_id`]: courseName }
        },
        OPTIONS: {
            COLUMNS: [
                `${datasetId}_id`,
                `${datasetId}_year`,
                `totalpass`,
                `totalfail`
            ],
            ORDER: {
                dir: "UP", // Recent years first
                keys: [`${datasetId}_year`]
            }
        },
        TRANSFORMATIONS: {
            GROUP: [`${datasetId}_id`, `${datasetId}_year`],
            APPLY: [
                { totalpass: { SUM: `${datasetId}_pass` } },
                { totalfail: { SUM: `${datasetId}_fail` } }
            ]
        }
    };
}

let passFailChartInstance = null;

function drawPassFailChart(data, datasetId) {
    const ctx = document.getElementById("pass-fail-chart").getContext("2d");

    if (passFailChartInstance) {
        passFailChartInstance.destroy();
    }

    const labels = data.map((entry) => entry[`${datasetId}_year`]);
    const passCounts = data.map((entry) => entry.totalpass);
    const failCounts = data.map((entry) => entry.totalfail);

    passFailChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Pass",
                    data: passCounts,
                    backgroundColor: "rgba(75, 192, 192, 0.6)"
                },
                {
                    label: "Fail",
                    data: failCounts,
                    backgroundColor: "rgba(255, 99, 132, 0.6)"
                }
            ]
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
                        text: "Number of Students"
                    }
                }
            }
        }
    });
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// USER STORY 7: STUDENT'S COURSE OF INTEREST
document.getElementById("audit-count-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const datasetId = document.getElementById("audit-dataset-id").value.trim();
    const courseId = document.getElementById("audit-course-id").value.trim();

	const datasetIds = await fetchAllDatasetIds();
    if (!datasetId || !datasetIds.includes(datasetId)) {
        document.getElementById("audit-query-status").textContent = "Invalid datacourse";
		auditChartInstance.destroy();
        return;
    }

    document.getElementById("audit-query-status").textContent = "";
    generateAuditBarChart(datasetId, courseId);
});

async function generateAuditBarChart(datasetId, courseId) {
    clearAllMessages();

    try {
        const query = buildAuditQuery(datasetId, courseId);

        const response = await fetch(`${SERVER_URL}/query`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(query)
        });

        if (response.ok) {
            const result = await response.json();
            if (result.result.length === 0) {
                document.getElementById("audit-query-status").textContent = "No data found for the specified course.";
                return;
            }

            drawAuditBarChart(result.result, datasetId);
        } else {
            const error = await response.text();
            document.getElementById("audit-query-status").textContent = `Error: ${error}`;
        }
    } catch (err) {
        document.getElementById("audit-query-status").textContent = `Error: ${err.message}`;
    }
}

function buildAuditQuery(datasetId, courseId) {
    const query = {
		WHERE: {
			IS: { [`${datasetId}_id`]: courseId }
		},
		OPTIONS: {
			COLUMNS: [
				`${datasetId}_id`,
                `${datasetId}_year`,
				"avgaudit"
			],
			ORDER: {
				dir: "UP",
				keys: [`${datasetId}_year`]
			}
		},
		TRANSFORMATIONS: {
			GROUP: [`${datasetId}_id`, `${datasetId}_year`],
			APPLY: [
				{ avgaudit: { AVG: `${datasetId}_audit` } }
			]
		}
	};

    return query;
}

let auditChartInstance = null;

function drawAuditBarChart(data, datasetId) {
    const ctx = document.getElementById("audit-bar-chart").getContext("2d");

    if (auditChartInstance) {
        auditChartInstance.destroy();
    }

    const labels = data.map((entry) => entry[`${datasetId}_year`]);
    const auditCounts = data.map((entry) => entry.avgaudit);

    auditChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Average Audit Count",
                data: auditCounts,
                backgroundColor: "rgba(75, 192, 192, 0.6)"
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
                        text: "Average Audit Count"
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const year = labels[context.dataIndex];
                            return `Year: ${year}, Audits: ${context.raw}`;
                        }
                    }
                }
            }
        }
    });
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// USER STORY 8: COURSE MAJOR DIFFICULTY
document.getElementById("department-analysis-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const datasetId = document.getElementById("avg-pass-dataset-id").value.trim();
    const startYear = parseInt(document.getElementById("start-year").value);
    const endYear = parseInt(document.getElementById("end-year").value);

	const datasetIds = await fetchAllDatasetIds();
    if (!datasetId || !datasetIds.includes(datasetId) || isNaN(startYear) || isNaN(endYear)) {
        document.getElementById("major-query-status").textContent = "Invalid datacourse";
		window.scatterChart.destroy();
        return;
    }

    try {
        const query = buildDepartmentAnalysisQuery(datasetId, startYear, endYear);
        const response = await fetch(`${SERVER_URL}/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(query),
        });

        if (response.ok) {
            const result = await response.json();
            drawScatterPlot(result.result, datasetId);
        } else {
            console.error("Error querying dataset:", await response.text());
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
});

function buildDepartmentAnalysisQuery(datasetId, startYear, endYear) {
    return {
        WHERE: {
            AND: [
                { GT: { [`${datasetId}_year`]: startYear } },
                { LT: { [`${datasetId}_year`]: endYear} }
            ]
        },
        OPTIONS: {
            COLUMNS: [
                `${datasetId}_dept`,
                "averageGrade",
                "totalPass",
                "totalFail",
                "totalAudit"
            ],
            ORDER: {
                dir: "UP",
                keys: [`${datasetId}_dept`]
            }
        },
        TRANSFORMATIONS: {
            GROUP: [`${datasetId}_dept`],
            APPLY: [
                {
                    averageGrade: {
                        AVG: `${datasetId}_avg`
                    }
                },
                {
                    totalPass: {
                        SUM: `${datasetId}_pass`
                    }
                },
                {
                    totalFail: {
                        SUM: `${datasetId}_fail`
                    }
                },
                {
                    totalAudit: {
                        SUM: `${datasetId}_audit`
                    }
                }
            ]
        }
    };
}

function drawScatterPlot(data, datasetId) {
    const ctx = document.getElementById("department-scatter-plot").getContext("2d");

    const scatterData = data.map((entry) => {
        const totalStudents = entry.totalPass + entry.totalFail + entry.totalAudit;
        const passRate = totalStudents > 0 ? (entry.totalPass / totalStudents) * 100 : 0; // Convert to percentage
        return {
            x: passRate,
            y: entry.averageGrade,
            label: entry[`${datasetId}_dept`] || "Unknown Department",
        };
    });

    const labels = data.map((entry) => entry[`${datasetId}_dept`]);

    console.log(JSON.stringify(data, null, 2));

    const colors = scatterData.map(() => `hsl(${Math.random() * 360}, 100%, 50%)`);

    if (window.scatterChart) {
        window.scatterChart.destroy();
    }

    window.scatterChart = new Chart(ctx, {
        type: "scatter",
        data: {
            datasets: scatterData.map((point, index) => ({
                label: point.label,
                data: [{ x: point.x, y: point.y }],
                backgroundColor: colors[index],
            })),
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const dept = labels[context.dataIndex];
                            const { x, y } = context.raw;
                            return `Dept: ${dept}, Pass Rate: ${x.toFixed(2)}%, Avg Grade: ${y.toFixed(2)}`;
                        },
                    },
                },
                legend: {
                    display: false,
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Pass Rate (%)",
                    },
                    min: 0,
                    max: 100,
                },
                y: {
                    title: {
                        display: true,
                        text: "Average Grade",
                    },
                },
            },
        },
    });
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// USER STORY 9: RETRIEVE COURSE STATISTICS
document.getElementById("course-stats-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const datasetId = document.getElementById("stats-dataset-id").value.trim();
    const courseId = document.getElementById("stats-course-id").value.trim();
    const specificGrade = parseFloat(document.getElementById("specific-grade").value);
    const yearRange = document.getElementById("stats-year-range").value.trim();

    // Validate inputs
    if (!datasetId || isNaN(specificGrade)) {
        document.getElementById("stats-query-status").textContent = "Dataset ID and Specific Grade are required.";
        if (statsChartInstance) statsChartInstance.destroy();
        return;
    }

    document.getElementById("stats-query-status").textContent = "";
    await generateStatsBoxplot(datasetId, courseId, specificGrade, yearRange);
});

async function generateStatsBoxplot(datasetId, courseId, specificGrade, yearRange) {
    try {
        const query = buildStatsQuery(datasetId, courseId, yearRange);
        console.log("Generated Query:", JSON.stringify(query, null, 2));

        const response = await fetch(`${SERVER_URL}/query`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(query)
        });

        if (response.ok) {
            const result = await response.json();

            if (!result.result.length) {
                document.getElementById("stats-query-status").textContent = "No data found for the specified course and year range.";
                return;
            }

            const processedStats = processRawGrades(result.result, datasetId);
            drawStatsBoxplot(processedStats, specificGrade);
        } else {
            const error = await response.text();
            document.getElementById("stats-query-status").textContent = `Error: ${error}`;
            if (statsChartInstance) statsChartInstance.destroy();
        }
    } catch (err) {
        document.getElementById("stats-query-status").textContent = `Error: ${err.message}`;
        if (statsChartInstance) statsChartInstance.destroy();
    }
}

function buildStatsQuery(datasetId, courseId, yearRange) {
    const query = {
        WHERE: {
            AND: []
        },
        OPTIONS: {
            COLUMNS: [`${datasetId}_id`, `${datasetId}_avg`, `${datasetId}_year`],
            ORDER: {
                dir: "UP",
                keys: [`${datasetId}_avg`]
            }
        }
    };

    if (courseId) {
        query.WHERE.AND.push({
            IS: { [`${datasetId}_id`]: courseId }
        });
    }

    if (yearRange) {
        const [startYear, endYear] = yearRange.split("-").map(Number);
        if (startYear && endYear && startYear <= endYear) {
            query.WHERE.AND.push({
                AND: [
                    { GT: { [`${datasetId}_year`]: startYear } },
                    { LT: { [`${datasetId}_year`]: endYear } }
                ]
            });
        } else {
            document.getElementById("stats-query-status").textContent = "Invalid year range format. Use YYYY-YYYY.";
            return null;
        }
    }

    if (!courseId && !yearRange) {
        query.WHERE = {};
    }

    return query;
}

function processRawGrades(data, datasetId) {
    const grades = data.map((entry) => entry[`${datasetId}_avg`]);

    const count = grades.length;
    const sum = grades.reduce((acc, grade) => acc + grade, 0);
    const min = Math.min(...grades);
    const max = Math.max(...grades);
    const mean = sum / count;

    // Variance calculation: Σ((x_i - mean)^2) / count
    const variance = grades.reduce((acc, grade) => acc + Math.pow(grade - mean, 2), 0) / count;

    // Standard deviation
    const stddev = Math.sqrt(variance);

    return { min, max, mean, variance, stddev, count };
}

let statsChartInstance = null;

function drawStatsBoxplot(stats, specificGrade) {
    const ctx = document.getElementById("stats-boxplot").getContext("2d");

    if (statsChartInstance) {
        statsChartInstance.destroy();
    }

    statsChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Statistics"], // Single label for grouped statistics
            datasets: [
                {
                    label: "Min",
                    data: [stats.min],
                    backgroundColor: "rgba(255, 99, 132, 0.6)"
                },
                {
                    label: "Max",
                    data: [stats.max],
                    backgroundColor: "rgba(54, 162, 235, 0.6)"
                },
                {
                    label: "Mean",
                    data: [stats.mean],
                    backgroundColor: "rgba(75, 192, 192, 0.6)"
                },
                {
                    label: "Standard Deviation",
                    data: [stats.stddev],
                    backgroundColor: "rgba(255, 206, 86, 0.6)"
                },
                {
                    label: "Variance",
                    data: [stats.variance],
                    backgroundColor: "rgba(153, 102, 255, 0.6)"
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Metrics"
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Grade Values"
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.raw.toFixed(2)}`
                    }
                }
            }
        }
    });

    calculateProbability(stats.mean, stats.stddev, specificGrade);
}

function calculateProbability(mean, stddev, specificGrade) {
    const distance = Math.abs(mean - specificGrade);
    const k = distance / stddev;
    const probability = k >= 1 ? Math.min(1, 1 - 1 / (k * k)) : 0;

    alert(`Probability of achieving a score above ${specificGrade}: ${(probability * 100).toFixed(2)}%`);
}







