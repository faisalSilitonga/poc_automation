const { createObjectCsvWriter } = require('csv-writer'); // Using require in CommonJS


// Function to write the scraped data to CSV
async function writeDataToCSV(outputFilePath, data) {
    // Get all unique headers from the data objects
    const headers = Object.keys(data.reduce((acc, row) => {
        Object.keys(row).forEach(key => acc[key] = true); // Collect unique keys (headers)
        return acc;
    }, {}));

    // Create CSV writer
    const csvWriter = createObjectCsvWriter({
        path: outputFilePath,
        header: headers.map(header => ({ id: header, title: header }))
    });

    try {
        // Write the data to the CSV file
        await csvWriter.writeRecords(data);
        console.log('Data written to CSV successfully');
    } catch (err) {
        console.error('Error writing to CSV:', err);
    }
}

module.exports = {
    writeDataToCSV,
}