var sheetName = "RecordKambing"; 
var orderSheetName = "List Order"; 
var ss = SpreadsheetApp.openById("1LeUEAOSHE7Zqjw4nCL1PuV-xjRX4zxupXnNWGQZT2wQ");

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Main");
}

// Function to get only "Berat" values where "Kuantiti" is greater than 0
function getFilteredBerat() {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log("Error: Sheet 'RecordKambing' not found!");
    return [];
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log("Error: No data available in 'RecordKambing'!");
    return [];
  }

  var filteredData = data.slice(1) // Exclude header row
    .filter(row => row.length >= 2 && row[1] > 0) // Ensure "Kuantiti" > 0 (Column B)
    .map(row => row[0]); // Extract "Berat" (Column A)

  Logger.log("Filtered Berat Data: " + JSON.stringify(filteredData)); // Debugging
  return filteredData;
}

// Function to get all stored records for display
function getAllRecords() {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log("Error: Sheet 'RecordKambing' not found!");
    return [];
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log("Error: No data available in 'RecordKambing'!");
    return [];
  }

  var validData = data.slice(1) // Exclude headers
    .filter(row => row.length >= 2 && row[1] > 0) // Only keep records where "Kuantiti" > 0
    .map(row => [row[0], row[1]]); // Return only "Berat" (Column A) & "Kuantiti" (Column B)

  Logger.log("All Records Data: " + JSON.stringify(validData)); // Debugging
  return validData;
}

// Function to save Name, Berat, Kuantiti, Date, Status, and Collect Date to "List Order" and update "RecordKambing"
function saveToListOrder(name, quantities, status, collectDate) {
    var orderSheet = ss.getSheetByName(orderSheetName);
    if (!orderSheet) {
        orderSheet = ss.insertSheet(orderSheetName);
        orderSheet.appendRow(["Name", "Berat", "Kuantiti", "Date Order", "Status", "Date Collect"]);
    }

    if (!quantities || Object.keys(quantities).length === 0) {
        Logger.log("Error: No quantities provided!");
        return "Error: No quantities provided.";
    }

    var sheet = ss.getSheetByName(sheetName);
    var data = sheet.getDataRange().getValues();
    var insufficientStock = false;
    var currentDate = new Date().toISOString(); // Store order date in ISO format

    // **Step 1: Convert collectDate to ISO Format**
    let finalCollectDate = currentDate; // Default to order date

    if (status === "Reserve" && collectDate) {
        let parsedDate = new Date(collectDate);
        finalCollectDate = isNaN(parsedDate.getTime()) ? "Invalid Date" : parsedDate.toISOString();
    }

    // **Step 2: Validate stock before saving anything**
    Object.entries(quantities).forEach(([berat, kuantiti]) => {
        if (!kuantiti || isNaN(kuantiti) || kuantiti <= 0) return;

        for (var i = 1; i < data.length; i++) {
            if (data[i][0] == berat) {
                var currentKuantiti = parseInt(data[i][1]);
                var subtractKuantiti = parseInt(kuantiti);

                if (subtractKuantiti > currentKuantiti) {
                    Logger.log(`Error: Not enough stock for Berat ${berat}`);
                    insufficientStock = true;
                    break;
                }
            }
        }
    });

    if (insufficientStock) {
        return "Error: Some items exceed available stock. Please adjust your quantities.";
    }

    // **Step 3: Save to "List Order"**
    var updated = false;

    Object.entries(quantities).forEach(([berat, kuantiti]) => {
        for (var i = 1; i < data.length; i++) {
            if (data[i][0] == berat) {
                var currentKuantiti = parseInt(data[i][1]);
                var subtractKuantiti = parseInt(kuantiti);

                var newKuantiti = currentKuantiti - subtractKuantiti;
                sheet.getRange(i + 1, 2).setValue(newKuantiti);
                Logger.log(`Updated Berat ${berat}: New Kuantiti = ${newKuantiti}`);
                updated = true;
                break;
            }
        }

        orderSheet.appendRow([name, berat, kuantiti, currentDate, status, finalCollectDate]);
    });

    return updated ? "Order saved and stock updated successfully!" : "Error: Something went wrong, try again.";
}



// Function to fetch all orders from "List Order"
// Function to fetch orders from "List Order" with optional status filter
function getAllOrders(statusFilter) {
  var orderSheet = ss.getSheetByName(orderSheetName);
  
  if (!orderSheet) {
    Logger.log("Error: 'List Order' sheet not found!");
    return [];
  }

  var data = orderSheet.getDataRange().getValues();
  
  if (!data || data.length <= 1) { // Check if data is empty or only has headers
    Logger.log("Error: No data available in 'List Order'!");
    return [];
  }

  var allOrders = data.slice(1) // Exclude headers
    .filter(row => row.length >= 5) // Ensure row has required columns
    .filter(row => !statusFilter || row[4] === statusFilter) // Apply status filter if provided
    .map(row => {
        let name = row[0];
        let berat = row[1];
        let kuantiti = row[2];
        let dateValue = row[3];
        let status = row[4];

        // Convert date if it's a number (Google Sheets stores dates as numbers)
        let formattedDate;
        if (typeof dateValue === "number") {
            formattedDate = new Date((dateValue - 25569) * 86400000).toISOString(); // Convert to ISO format
        } else if (typeof dateValue === "string") {
            formattedDate = dateValue; // Keep as is if already a string
        } else {
            formattedDate = "Invalid Date"; // Handle unexpected cases
        }

        return [name, berat, kuantiti, formattedDate, status];
    });

  Logger.log("Filtered Orders Data: " + JSON.stringify(allOrders)); // Debugging
  return allOrders.length > 0 ? allOrders : [];
}

function updateOrderStatus(rowIndex, newStatus) {
  var orderSheet = ss.getSheetByName(orderSheetName);
  var tableSheet = ss.getSheetByName(sheetName);
  
  if (!orderSheet || !tableSheet) {
    Logger.log("Error: 'List Order' or 'RecordKambing' sheet not found!");
    return "Error: 'List Order' or 'RecordKambing' sheet not found!";
  }

  var orderData = orderSheet.getDataRange().getValues();
  var tableData = tableSheet.getDataRange().getValues();

  if (rowIndex < 0 || rowIndex >= orderData.length - 1) {
    Logger.log("Error: Invalid row index.");
    return "Error: Invalid row index.";
  }

  var rowNumber = rowIndex + 2; // Adjust for zero-based index and header row
  var berat = orderData[rowIndex + 1][1]; // Column B (Berat)
  var kuantiti = parseInt(orderData[rowIndex + 1][2]); // Column C (Kuantiti)
  var currentStatus = orderData[rowIndex + 1][4]; // Column E (Status)

  if (currentStatus === "Reserve" && newStatus === "Confirm") {
    orderSheet.getRange(rowNumber, 5).setValue("Confirm"); // Update Status to Confirm
    Logger.log(`Order at row ${rowNumber} changed from "Reserve" to "Confirm"`);
    return "Order status updated to Confirm";

  } else if (newStatus === "Cancel") {
    orderSheet.getRange(rowNumber, 5).setValue("Cancelled"); // Update Status to Cancelled
    Logger.log(`Order at row ${rowNumber} changed to "Cancelled"`);

    // **Step 1: Restore Kuantiti back into "RecordKambing"**
    for (var i = 1; i < tableData.length; i++) { // Skip header row
      if (tableData[i][0] == berat) { // Column A (Berat)
        var currentKuantiti = parseInt(tableData[i][1]); // Column B (Kuantiti)
        var newKuantiti = currentKuantiti + kuantiti; // Restore Kuantiti

        tableSheet.getRange(i + 1, 2).setValue(newKuantiti); // Update "Kuantiti" in Column B
        Logger.log(`Restored Kuantiti for Berat ${berat}: New Kuantiti = ${newKuantiti}`);
        return `Order cancelled and ${kuantiti} added back to RecordKambing for Berat ${berat}`;
      }
    }

    Logger.log(`Error: Berat ${berat} not found in RecordKambing`);
    return `Error: Berat ${berat} not found in RecordKambing.`;
  } else {
    Logger.log("Invalid status update request.");
    return "Invalid status update request.";
  }
}






