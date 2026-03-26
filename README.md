# insightUBC

insightUBC is a web application that allows users to explore and analyze UBC course and room datasets.

Users can upload datasets and run structured queries to filter, sort, and analyze the data. The system simulates core database functionality, but all query processing logic was implemented manually without using a database.

## Overview

The system supports:
- Adding and removing datasets
- Querying structured course and room data
- Filtering and sorting results
- Aggregation operations (e.g., averages)
- Persisting datasets between runs

## Tech Stack

- TypeScript
- Node.js
- HTML / CSS / JavaScript
- D3.js (data visualization)
- Mocha / Chai (testing)
- ESLint / Prettier

## Key Challenges

- Building a query engine without relying on a database
- Parsing and validating user-defined queries correctly
- Handling large datasets and ensuring efficient data processing
- Converting unstructured HTML data into structured formats
- Maintaining clean and modular code

## Visualization

Query results were visualized using interactive histograms and pie charts built with D3.js.

## What I Learned

- How backend systems process and transform structured data
- How query engines work internally
- Writing maintainable TypeScript code
- Working in a team using Agile practices, code reviews, and testing

## Notes

This project was completed as part of a UBC coursework project in a team of three.
