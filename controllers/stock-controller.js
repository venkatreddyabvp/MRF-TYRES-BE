import Stock from "../models/stock-model.js";
import Sales from "../models/sales-model.js";
import { sendEmail } from "../utils/mailer.js";

export const addStock = async (req, res) => {
  try {
    const {
      date,
      quantity,
      tyreSize,
      SSP,
      totalAmount,
      pricePerUnit,
      location,
    } = req.body;
    const { role } = req.user;

    if (!["owner", "worker"].includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!location) {
      return res.status(400).json({ message: "Location is required" });
    }

    const existingOpenStock = await Stock.findOne({
      date: new Date(date).toISOString().split("T")[0],
      tyreSize,
      status: "open-stock",
      location,
    });

    if (existingOpenStock) {
      return res.status(400).json({
        message:
          "Open stock already exists for this tyreSize and location. Please update the existing open stock.",
      });
    }

    let previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    let previousStock = await Stock.findOne({
      date: previousDate.toISOString().split("T")[0],
      tyreSize,
      status: "existing-stock",
      location,
    });

    if (!previousStock) {
      const previousOpenStock = await Stock.findOne({
        date: previousDate.toISOString().split("T")[0],
        tyreSize,
        status: "open-stock",
        location,
      });

      if (previousOpenStock) {
        previousStock = new Stock({
          date: previousDate.toISOString().split("T")[0],
          status: "existing-stock",
          quantity: previousOpenStock.quantity,
          tyreSize,
          SSP: previousOpenStock.SSP,
          totalAmount: previousOpenStock.totalAmount,
          pricePerUnit: previousOpenStock.pricePerUnit,
          location,
        });
        await previousStock.save();
      } else {
        previousStock = new Stock({
          date: previousDate.toISOString().split("T")[0],
          status: "existing-stock",
          quantity: 0,
          tyreSize,
          SSP: SSP,
          totalAmount: 0,
          pricePerUnit: pricePerUnit,
          location,
        });
        await previousStock.save();
      }
    }

    const newOpenStock = new Stock({
      date: new Date(date).toISOString().split("T")[0],
      status: "open-stock",
      quantity: previousStock.quantity,
      tyreSize,
      SSP: previousStock.SSP,
      totalAmount: previousStock.totalAmount,
      pricePerUnit: previousStock.pricePerUnit,
      location,
    });
    await newOpenStock.save();

    const newExistingStock = new Stock({
      date: new Date(date).toISOString().split("T")[0],
      status: "existing-stock",
      quantity: previousStock.quantity + quantity,
      tyreSize,
      SSP: SSP,
      totalAmount: previousStock.totalAmount + totalAmount,
      pricePerUnit: pricePerUnit,
      location,
    });
    await newExistingStock.save();

    res.status(201).json({ message: "Stock updated successfully" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Failed to update stock", error: err.message });
  }
};

//updating the stock__________________________________________________
export const updateOpenStock = async (req, res) => {
  try {
    const {
      date,
      quantity,
      tyreSize,
      SSP,
      totalAmount,
      pricePerUnit,
      location,
    } = req.body;
    const { role } = req.user;

    if (!["owner", "worker"].includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Find open-stock record with the same tyreSize and date
    let stock = await Stock.findOne({
      date: new Date(date).toISOString().split("T")[0],
      tyreSize,
      status: "open-stock",
      location,
    });

    if (!stock) {
      return res
        .status(404)
        .json({ message: "Open stock not found for this tyreSize and date" });
    }

    // Update existing open-stock record with new quantity and totalAmount
    stock.quantity += quantity;
    stock.totalAmount += totalAmount;
    await stock.save();

    // Find existing-stock record with the same tyreSize and date
    let existingStock = await Stock.findOne({
      date: new Date(date).toISOString().split("T")[0],
      tyreSize,
      status: "existing-stock",
      location,
    });

    if (!existingStock) {
      // Create a new existing-stock record from open-stock values
      existingStock = new Stock({
        date: new Date(date).toISOString().split("T")[0],
        status: "existing-stock",
        quantity: stock.quantity,
        tyreSize,
        SSP,
        totalAmount: stock.totalAmount,
        pricePerUnit,
        location,
      });
    } else {
      // Update existing-stock record with new quantity and totalAmount
      existingStock.quantity += quantity;
      existingStock.totalAmount += totalAmount;
    }

    // Save the existing-stock record
    await existingStock.save();

    res.status(200).json({ message: "Stock updated successfully" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Failed to update stock", error: err.message });
  }
};

//record sale______________________________________
export const recordSale = async (req, res) => {
  try {
    const {
      date,
      quantity,
      customerName,
      phoneNumber,
      comment,
      tyreSize,
      pricePerUnit,
      location,
    } = req.body;
    const { role, id: userId } = req.user;

    // Check if the user has the owner or worker role
    if (!["owner", "worker"].includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Parse the date or use the current date if not provided
    const currentDate = date ? new Date(date) : new Date();

    // Check if there is existing stock for the current date and tyreSize
    let existingStock = await Stock.findOne({
      date: currentDate.toISOString().split("T")[0],
      tyreSize,
      status: "existing-stock",
      location,
    });

    // If there is no existing stock, check for existing stock of the previous day
    if (!existingStock) {
      const previousDate = new Date(currentDate);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousStock = await Stock.findOne({
        date: previousDate.toISOString().split("T")[0],
        tyreSize,
        status: "existing-stock",
        location,
      });

      if (previousStock) {
        // Create a new existing-stock record from the previous day's stock
        existingStock = new Stock({
          date: currentDate.toISOString().split("T")[0],
          status: "existing-stock",
          quantity: previousStock.quantity,
          tyreSize: previousStock.tyreSize,
          SSP: previousStock.SSP,
          totalAmount: previousStock.totalAmount,
          pricePerUnit: previousStock.pricePerUnit,
          location: previousStock.location,
        });
        await existingStock.save();
      } else {
        // If there is no previous day's stock, check for open stock
        const openStock = await Stock.findOne({
          date: currentDate.toISOString().split("T")[0],
          tyreSize,
          status: "open-stock",
          location,
        });

        if (openStock) {
          // Create a new existing-stock record from the open stock
          existingStock = new Stock({
            date: currentDate.toISOString().split("T")[0],
            status: "existing-stock",
            quantity: openStock.quantity,
            tyreSize: openStock.tyreSize,
            SSP: openStock.SSP,
            totalAmount: openStock.totalAmount,
            pricePerUnit: openStock.pricePerUnit,
            location: openStock.location,
          });
          await existingStock.save();
        } else {
          return res.status(404).json({ message: "Item not found in stock" });
        }
      }
    }

    // Calculate the total amount based on quantity and price per unit
    const totalAmount = quantity * pricePerUnit;

    // Check if the requested quantity is available in existing stock
    if (existingStock.quantity < quantity) {
      return res.status(400).json({ message: "Insufficient stock quantity" });
    }

    // Update the existing-stock record with the new quantity and total amount
    existingStock.quantity -= quantity;
    existingStock.totalAmount -= totalAmount;
    await existingStock.save();

    // Create a new sales record
    const newSale = new Sales({
      date: currentDate.toISOString().split("T")[0],
      quantity,
      customerName,
      phoneNumber,
      comment,
      tyreSize,
      pricePerUnit,
      totalAmount,
      location,
      user: userId,
    });
    await newSale.save();

    res.status(201).json({ message: "Sale recorded successfully" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Failed to record sale", error: err.message });
  }
};

//get OpenStock_____
export const getOpenStock = async (req, res) => {
  try {
    const currentDate = new Date().toISOString().split("T")[0];
    const previousDate = new Date(currentDate);
    previousDate.setDate(previousDate.getDate() - 1);

    // Find all distinct tyre sizes from existing open-stock records for the current date
    const existingOpenStockTyreSizes = await Stock.distinct("tyreSize", {
      date: currentDate,
      status: "open-stock",
    });

    // Find all distinct locations from existing open-stock records for the current date
    const existingOpenStockLocations = await Stock.distinct("location", {
      date: currentDate,
      status: "open-stock",
    });

    // Find all distinct tyre sizes from existing-stock records of the previous date
    const existingStockPreviousDateTyreSizes = await Stock.distinct(
      "tyreSize",
      {
        date: previousDate.toISOString().split("T")[0],
        status: "existing-stock",
      },
    );

    // Find all distinct locations from existing-stock records of the previous date
    const existingStockPreviousDateLocations = await Stock.distinct(
      "location",
      {
        date: previousDate.toISOString().split("T")[0],
        status: "existing-stock",
      },
    );

    // Get missing tyre sizes and locations
    const missingTyreSizes = existingStockPreviousDateTyreSizes.filter(
      (tyreSize) => !existingOpenStockTyreSizes.includes(tyreSize),
    );

    const missingLocations = existingStockPreviousDateLocations.filter(
      (location) => !existingOpenStockLocations.includes(location),
    );

    // Create open-stock records for missing tyre sizes and locations from existing-stock of the previous date
    const missingOpenStock = [];

    // Use Promise.all to wait for all operations to complete
    await Promise.all(
      missingTyreSizes.map(async (tyreSize) => {
        await Promise.all(
          missingLocations.map(async (location) => {
            const existingStockRecord = await Stock.findOne({
              date: previousDate.toISOString().split("T")[0],
              status: "closing-stock",
              tyreSize,
              location,
            });

            if (existingStockRecord) {
              const newStock = new Stock({
                date: currentDate,
                status: "open-stock",
                quantity: existingStockRecord.quantity,
                tyreSize: existingStockRecord.tyreSize,
                SSP: existingStockRecord.SSP,
                totalAmount: existingStockRecord.totalAmount,
                pricePerUnit: existingStockRecord.pricePerUnit,
                location: existingStockRecord.location,
              });
              missingOpenStock.push(newStock);
            }
          }),
        );
      }),
    );

    // Save the missing open-stock records without overwriting existing records
    for (const stock of missingOpenStock) {
      const existingRecord = await Stock.findOne({
        date: stock.date,
        status: "open-stock",
        tyreSize: stock.tyreSize,
        location: stock.location,
      });

      if (!existingRecord) {
        await stock.save();
      }
    }

    // Find and return all open-stock records
    const allOpenStock = await Stock.find({
      status: "open-stock",
    });

    res.status(200).json({ openStock: allOpenStock });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Failed to get open stock" });
  }
};

export const getExistingStock = async (req, res) => {
  try {
    // Retrieve all "existing-stock" records
    let allExistingStock = await Stock.find({ status: "existing-stock" });

    // Get the current date
    const currentDate = new Date().toISOString().split("T")[0];

    // Find "existing-stock" records for the current date
    let currentExistingStock = allExistingStock.filter(
      (stock) => stock.date === currentDate,
    );

    // If there is no existing stock for the current date, create from current date "open-stock"
    if (currentExistingStock.length === 0) {
      const openStock = await Stock.find({
        date: currentDate,
        status: "open-stock",
      });

      if (openStock.length > 0) {
        // Create new existing-stock records from current date open-stock records
        for (const stock of openStock) {
          const existingRecord = await Stock.findOne({
            date: stock.date,
            status: "existing-stock",
            tyreSize: stock.tyreSize,
            location: stock.location,
          });

          if (!existingRecord) {
            const newStock = new Stock({
              date: currentDate,
              status: "existing-stock",
              quantity: stock.quantity,
              tyreSize: stock.tyreSize,
              SSP: stock.SSP,
              totalAmount: stock.totalAmount,
              pricePerUnit: stock.pricePerUnit,
              location: stock.location,
            });
            await newStock.save();
          }
        }

        // Retrieve the newly created existing-stock records
        currentExistingStock = await Stock.find({
          date: currentDate,
          status: "existing-stock",
        });
      }
    }

    // If there is existing stock from the previous date, create a "closing-stock" record
    if (currentExistingStock.length === 0) {
      const previousDate = new Date(currentDate);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousStock = await Stock.find({
        date: previousDate.toISOString().split("T")[0],
        status: "existing-stock",
      });

      if (previousStock.length > 0) {
        // Create a copy of the previous date existing stock and change status to "closing-stock"
        for (const stock of previousStock) {
          const existingRecord = await Stock.findOne({
            date: stock.date,
            status: "existing-stock",
            tyreSize: stock.tyreSize,
            location: stock.location,
          });

          if (!existingRecord) {
            const newStock = new Stock({
              date: currentDate,
              status: "closing-stock",
              quantity: stock.quantity,
              tyreSize: stock.tyreSize,
              SSP: stock.SSP,
              totalAmount: stock.totalAmount,
              pricePerUnit: stock.pricePerUnit,
              location: stock.location,
            });
            await newStock.save();
          }
        }
      }
    }

    // Retrieve all "existing-stock" records again to ensure we have the latest data
    allExistingStock = await Stock.find({ status: "existing-stock" });

    res.status(200).json({ existingStock: allExistingStock });
  } catch (err) {
    console.error(err);
    res
      .status(400)
      .json({ message: "Failed to get existing stock", error: err.message });
  }
};

export const getOpenStockDays = async (req, res) => {
  try {
    // Find all "open-stock-day" records
    const openStockDays = await Stock.find({ status: "open-stock-day" });

    res.status(200).json({ openStockDays });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Failed to get open stock days" });
  }
};

export const getSalesRecords = async (req, res) => {
  try {
    // Find all sales records
    const salesRecords = await Sales.find();

    res.status(200).json({ salesRecords });
  } catch (err) {
    console.error(err);
    res
      .status(400)
      .json({ message: "Failed to get sales records", error: err.message });
  }
};

// controllers/stockController.js
export const getClosingStock = async (req, res) => {
  try {
    // Retrieve all "closing-stock" records
    let allClosingStock = await Stock.find({ status: "closing-stock" });

    // Get the current date and the previous date
    const currentDate = new Date();
    const previousDate = new Date(currentDate);
    previousDate.setDate(previousDate.getDate() - 1);

    // Check if there are any "closing-stock" records for the previous date
    const existingClosingStockPreviousDate = allClosingStock.filter(
      (stock) => stock.date === previousDate.toISOString().split("T")[0],
    );

    // If there are no "closing-stock" records for the previous date, create them from existing "existing-stock" or "open-stock" records
    if (existingClosingStockPreviousDate.length === 0) {
      const existingStockPreviousDate = await Stock.find({
        date: previousDate.toISOString().split("T")[0],
        $or: [{ status: "existing-stock" }, { status: "open-stock" }],
      });

      // Create new "closing-stock" records from existing "existing-stock" or "open-stock" records of the previous date
      const closingStock = [];
      for (const stock of existingStockPreviousDate) {
        const newStock = new Stock({
          date: previousDate.toISOString().split("T")[0], // Set the date to previous date
          status: "closing-stock",
          quantity: stock.quantity,
          tyreSize: stock.tyreSize,
          SSP: stock.SSP,
          totalAmount: stock.totalAmount,
          pricePerUnit: stock.pricePerUnit,
          location: stock.location,
        });
        await newStock.save();
        closingStock.push(newStock);
      }

      // Add the newly created "closing-stock" records to the list
      allClosingStock = allClosingStock.concat(closingStock);
    }

    res.status(200).json({ closingStock: allClosingStock });
  } catch (err) {
    console.error(err);
    res
      .status(400)
      .json({ message: "Failed to get closing stock", error: err.message });
  }
};
const findDuplicates = async () => {
  const duplicates = await Stock.aggregate([
    {
      $group: {
        _id: {
          date: "$date",
          tyreSize: "$tyreSize",
          location: "$location",
          status: "$status",
        },
        uniqueIds: { $addToSet: "$_id" },
        count: { $sum: 1 },
      },
    },
    {
      $match: {
        count: { $gt: 1 },
      },
    },
  ]);

  return duplicates;
};

// Function to delete duplicates
export const deleteDuplicateStocks = async () => {
  try {
    const duplicates = await findDuplicates();

    if (duplicates.length === 0) {
      console.log("No duplicates found");
      return;
    }

    for (const record of duplicates) {
      const { uniqueIds } = record;
      // Keep one record and delete the rest
      uniqueIds.shift(); // Remove the first item to keep it
      await Stock.deleteMany({ _id: { $in: uniqueIds } });
    }

    // Recursively call the function until no duplicates are found
    await deleteDuplicateStocks();
  } catch (err) {
    console.error("Failed to delete duplicate stocks", err);
  }
};

// Example usage
// Call this function as needed, e.g., as part of a route handler or a scheduled job
deleteDuplicateStocks();
